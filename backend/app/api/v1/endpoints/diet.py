import torch
import torch.nn as nn
from torchvision import models, transforms
from ultralytics import YOLO
from PIL import Image, ImageOps
import pandas as pd
import io
import os
import uuid  
import shutil  # 파일 이동/복사를 위한 모듈 추가
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import date, datetime
from sqlalchemy import func
from app.database import get_db
from app.api.v1.endpoints.auth import get_current_user
from app.models.user import User
from app.models.diet_log import DietLog
from app.services.journal_ai import generate_and_save_ai_comment
import math

router = APIRouter()

# --- [1. 기본 하드웨어 및 경로 설정] ---
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

CURRENT_FILE_PATH = os.path.abspath(__file__)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(CURRENT_FILE_PATH))))

YOLO_COCO_PATH = os.path.join(BASE_DIR, "models", "food", "yolov11s.pt") # 그릇/접시 탐지용 범용 모델
YOLO_DIET_PATH = os.path.join(BASE_DIR, "models", "food", "best418.pt") # 헬스식단분류모델

MODEL_PATH = os.path.join(BASE_DIR, "models", "food", "best_137.pth")  # 한식분류모델 
DB_PATH = os.path.join(BASE_DIR, "data", "best_137.csv")
FOOD_CSV = os.path.join(BASE_DIR, "data", "food_master_음식_utf8.csv")     
PROCESS_CSV = os.path.join(BASE_DIR, "data", "food_master_가공_utf8.csv")     

# 📍 [수정] 임시 업로드 폴더와 영구 저장 폴더 구분 정의
UPLOAD_DIR = os.path.join(BASE_DIR, "static", "uploads", "food")
SAVE_DIR = os.path.join(BASE_DIR, "static", "uploads", "save")

os.makedirs(UPLOAD_DIR, exist_ok=True) 
os.makedirs(SAVE_DIR, exist_ok=True) # save 폴더 생성 자동화

print(f"📍 확인된 영양성분 CSV 경로: {FOOD_CSV}")

# --- [파일 영구 저장 헬퍼 함수 추가] ---
def move_image_to_save_dir(image_url: str) -> str:
    """
    임시 'food' 폴더에 있는 이미지 URL을 받아서 영구 'save' 폴더로 복사/이동하고,
    새로운 save 폴더 기준의 웹 접근 URL을 반환합니다.
    """
    if not image_url or "/static/uploads/food/" not in image_url:
        return image_url  # 이미 처리되었거나 잘못된 경로면 그대로 반환

    # URL에서 파일명 추출 (예: uuid_main.jpg)
    filename = os.path.basename(image_url)
    
    # 원본 파일 경로와 이동할 대상 파일 경로 설정
    src_path = os.path.join(UPLOAD_DIR, filename)
    dest_path = os.path.join(SAVE_DIR, filename)
    
    try:
        if os.path.exists(src_path):
            # 파일을 save 폴더로 복사 (안전하게 copy 후 원본은 나중에 배치로 지우거나 유지 가능)
            shutil.copy2(src_path, dest_path)
            # 웹에서 접근할 새로운 경로 반환
            return f"/static/uploads/save/{filename}"
    except Exception as e:
        print(f"❌ 이미지 영구 저장 중 오류 발생: {e}")
    
    return image_url

# --- [2. 공공 영양 데이터 로드 및 병합] ---
def load_and_merge_food_data():
    try:
        cols = ["식품명", "에너지(kcal)", "탄수화물(g)", "단백질(g)", "지방(g)"]
        df_food = pd.read_csv(FOOD_CSV, usecols=cols)
        df_proc = pd.read_csv(PROCESS_CSV, usecols=cols)
        full_df = pd.concat([df_food, df_proc], ignore_index=True)
        full_df.drop_duplicates(subset=["식품명"], keep="first", inplace=True)
        print(f"✅ 총 {len(full_df)}개의 식품 영양 데이터셋 로드 완료!")
        return full_df
    except Exception as e:
        print(f"❌ 데이터 로드 중 오류: {e}")
        return pd.DataFrame(columns=cols)

FOOD_MASTER_DF = load_and_merge_food_data()

# --- [3. EfficientNet 매칭용 헬퍼 함수] ---
def load_food_db(path, master_df):
    db = {}
    try:
        df = pd.read_csv(path, encoding='utf-8-sig') 
        for _, row in df.iterrows():
            try:
                f_id = int(row['id'])
                f_name = str(row['name']).strip() 
                
                target_nutrition = master_df[master_df["식품명"].str.contains(f_name, na=False, regex=False)]
                
                if not target_nutrition.empty:
                    nutri = target_nutrition.iloc[0]
                    kcal = float(nutri["에너지(kcal)"])
                    carbs = float(nutri["탄수화물(g)"])
                    protein = float(nutri["단백질(g)"])
                    fat = float(nutri["지방(g)"])
                else:
                    kcal = float(row.get('calories', 0))
                    carbs = float(row.get('carbs', 0))
                    protein = float(row.get('protein', 0))
                    fat = float(row.get('fat', 0))

                db[f_id] = {"name": f_name, "kcal": kcal, "carbs": carbs, "protein": protein, "fat": fat}
            except Exception as e:
                continue
    except Exception as e:
        print(f"구형 인덱스 DB 로드 실패: {e}")
    return db

FOOD_NUTRITION_DB = load_food_db(DB_PATH, FOOD_MASTER_DF)

DIET_CLASSES_MAP = {
    0: '계란', 1: '고구마', 2: '그릭요거트', 3: '닭가슴살', 4: '두부', 
    5: '바나나', 6: '방울토마토', 7: '아몬드', 8: '연어회', 9: '잡곡밥', 10: '현미밥'
}

def search_food_nutrition(name: str):
    if FOOD_MASTER_DF is None or FOOD_MASTER_DF.empty:
        return []
    results = FOOD_MASTER_DF[FOOD_MASTER_DF["식품명"].str.contains(name, na=False)].copy()    
    if not results.empty:
        results['name_len'] = results['식품명'].str.len()
        top_10 = results.sort_values(by='name_len').head(10)
        output = []
        for _, row in top_10.iterrows():
            output.append({
                "food_name": row["식품명"],
                "kcal": float(row["에너지(kcal)"]),
                "carbs": float(row["탄수화물(g)"]),
                "protein": float(row["단백질(g)"]),
                "fat": float(row["지방(g)"])
            })
        return output
    return []

# --- [4. 왜곡 방지 레터박스 패딩 전처리 함수] ---
def padding_preprocess(pil_img: Image.Image, target_size: int = 288) -> Image.Image:
    """
    이미지의 가로세로 비율(Aspect Ratio)을 완벽하게 유지하면서,
    긴 축이 무조건 target_size(288)가 되도록 '최대 확대/축소'한 뒤,
    남는 여백만 회색(128, 128, 128)으로 채웁니다.
    """
    orig_w, orig_h = pil_img.size
    
    # 1. 비율 유지를 위한 스케일 팩터(수치) 계산 (가로 기준, 세로 기준 중 더 작은 비율 선택)
    scale = min(target_size / orig_w, target_size / orig_h)
    
    # 2. 원본 비율을 유지하면서 '무조건' 긴 축이 288이 되도록 크기 계산 (확대/축소 강제)
    new_w = int(orig_w * scale)
    new_h = int(orig_h * scale)
    
    # 3. 고화질 보간법(LANCZOS)을 활용해 이미지 리사이즈 실행
    resized_img = pil_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    # 4. 288x288을 맞추기 위해 상하좌우에 넣을 여백(패딩) 계산
    delta_w = target_size - new_w
    delta_h = target_size - new_h
    
    # 좌, 상, 우, 하 순서로 패딩 분배
    padding = (delta_w // 2, delta_h // 2, delta_w - (delta_w // 2), delta_h - (delta_h // 2))
    
    # 5. 부족한 공간을 YOLO 레터박스 표준 색상인 회색(128)으로 채우기
    padded_img = ImageOps.expand(resized_img, padding, fill=(128, 128, 128))
    return padded_img

# EfficientNet-B2 입력 텐서 변환용 (리사이즈를 제외한 정규화만 수행)
classify_tensor_transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

# 모델 저장할 때 (학습 스크립트 측 변경 추천)
# torch.save(model.state_dict(), "best_137.pth")

# FastAPI에서 불러올 때 수정안
def load_classifier(path):
    # 1. 먼저 정확한 구조(B2)를 정의합니다.
    model = models.efficientnet_b2(weights=None)
    model.classifier[1] = nn.Linear(model.classifier[1].in_features, 137) # 클래스 개수 137개 맞추기

    # 2. 가중치만 안전하게 로드합니다.
    if os.path.exists(path):
        try:
            # 만약 state_dict로 저장했다면 아래 코드가 맞습니다.
            state_dict = torch.load(path, map_location=device)
            model.load_state_dict(state_dict)
            print("가중치(state_dict) 로드 완료!")
        except Exception:
            # 통째로 저장된 파일일 경우 백업 체계
            model = torch.load(path, map_location=device, weights_only=False)
            print("통째로 저장된 모델 파일 로드")

    model.to(device)
    model.eval()
    return model

# 삼대 엔진 가동
coco_yolo = YOLO(YOLO_COCO_PATH)  # 그릇 선별용 COCO 모델
diet_yolo = YOLO(YOLO_DIET_PATH)  # 헬스식단 전용 YOLO 모델
classifier = load_classifier(MODEL_PATH)  # 한식 분류용 EfficientNet

# --- [추가] 음식명에 따른 기본 Gram(g) 수 지정 헬퍼 함수 ---
def get_default_weight(food_name: str) -> int:
    """
    사용자의 식습관과 현실적인 섭취량을 반영한 기본 g수를 반환합니다.
    - 밥 종류: 200g (공기밥 1그릇 기준)
    - 국/탕 종류: 250g (일반 국그릇 1대접 기준)
    - 찌개/조림 종류: 300g (1인분 뚝배기 기준)
    - 메인 요리/면류: 150g ~ 200g (제육볶음, 파스타, 돈까스 등 단품 메인)
    - 일반 밑반찬 및 기타: 20g (김치 2조각, 밑반찬 한 젓가락 등 소량 섭취 기준)
    """
    food_name = food_name.strip()

    # ---------------------------------------------------------
    # [새로 추가] 헬스/다이어트 식단 전용 1차 분류 리스트
    # ---------------------------------------------------------
    # 1. 단백질류 (닭가슴살, 고기 단품 등 -> 시판 1팩 기준 100g)
    fitness_protein = ["닭가슴살", "닭안심", "소고기우둔살", "부채살", "연어구이", "두부면", "계란"] 
    # 2. 구황작물 탄수화물 (중간 크기 1개 기준 150g)
    fitness_carb = ["고구마", "감자", "단호박", "바나나", "방울토마토"]
    # 3. 보충제 및 견과류 (1스쿱 또는 1봉지 기준)
    fitness_shake = ["프로틴", "단백질쉐이크", "단백질보충제", "단백질바", "프로틴바"]
    fitness_nuts = ["아몬드", "견과류", "하루견과"]
    # 4. 다이어트 도시락/현미밥류 (시판 냉동도시락 1팩 기준 250g)
    fitness_lunchbox = ["다이어트도시락", "닭가슴살볶음밥", "샐러드"]


    # ---------------------------------------------------------
    # 1차 리스트 검사 (헬스 식단 먼저 체크)
    # ---------------------------------------------------------
    if any(kw in food_name for kw in fitness_protein):
        return 100
    if any(kw in food_name for kw in fitness_carb):
        return 150
    if any(kw in food_name for kw in fitness_shake):
        return 30
    if any(kw in food_name for kw in fitness_nuts):
        return 20
    if any(kw in food_name for kw in fitness_lunchbox):
        return 250
    
    # ---------------------------------------------------------
    # 1차 구분: 이름에 밥/국/찌개가 명시되지 않은 명시적 키워드 리스트
    # ---------------------------------------------------------
    rice_keywords = ["죽", "리조또", "볶음밥", "덮밥", "카레라이스", "하이라이스", "오므라이스", "김밥", "초밥"]
    soup_keywords = ["육개장", "설렁탕", "곰탕", "스프", "수프", "샤브샤브"]
    stew_keywords = ["짜글이", "두부조림", "고등어조림", "갈치조림", "찜"]
    
    # 한 그릇으로 끝나는 메인 요리 및 면류 리스트
    main_dish_keywords = ["국수", "파스타", "라멘", "우동", "짜장면", "짬뽕", "냉면", "돈까스", "스테이크", "치킨", "피자"]

    # 1차 리스트 검사
    if any(kw in food_name for kw in rice_keywords):
        return 200
    if any(kw in food_name for kw in stew_keywords):
        return 300
    if any(kw in food_name for kw in soup_keywords):
        return 250
    if any(kw in food_name for kw in main_dish_keywords):
        return 150  # 메인 요리나 면류는 한 그릇 기준 대략 150g~200g 잡음


    # ---------------------------------------------------------
    # 2차 구분: 규칙성을 가진 접미사(끝자리) 판단
    # ---------------------------------------------------------
    
    # [1] 밥 종류 (예: 잡곡밥, 현미밥, 쌀밥, 비빔밥 등)
    if food_name.endswith("밥") or " 밥" in food_name:
        return 200
        
    # [2] 찌개 및 조림 종류 (예: 김치찌개, 된장찌개, 부대찌개 등)
    elif food_name.endswith("찌개") or food_name.endswith("전골") or "찌개" in food_name:
        return 300
        
    # [3] 국/탕 종류 (예: 미역국, 콩나물국, 갈비탕, 감자탕 등)
    elif food_name.endswith("국") or food_name.endswith("탕"):
        return 250
        
    # [4] 큰 접시에 나오는 구이나 볶음류 메인 요리 (예: 제육볶음, 소불고기, 삼겹살구이 등)
    elif food_name.endswith("볶음") or food_name.endswith("구이") or food_name.endswith("튀김"):
        return 150


    # ---------------------------------------------------------
    # 3차 구분: 밥/국/찌개/메인이 모두 아닌 '진짜 밑반찬'
    # ---------------------------------------------------------
    else:
        # 김치, 멸치볶음, 콩자반, 무말랭이, 단무지 등 소량씩 집어 먹는 밑반찬류
        return 20

# --- [5. API 엔드포인트 핵심 로직] ---

@router.get("/search-nutrition")
def search_nutrition_api(name: str):
    if not name:
        raise HTTPException(status_code=400, detail="음식 이름을 입력하세요.")
    result = search_food_nutrition(name) 
    if result:
        return result
    return [{"food_name": name, "kcal": 0, "carbs": 0, "protein": 0, "fat": 0}]

@router.post("/analyze")
async def analyze_food(file: UploadFile = File(...)):    
    try:
        image_data = await file.read()
        original_img = Image.open(io.BytesIO(image_data)).convert('RGB')

        main_filename = f"{uuid.uuid4()}_main.jpg"
        main_path = os.path.join(UPLOAD_DIR, main_filename)
        original_img.save(main_path, "JPEG")

        final_detected_items = []
        
        # Step 1: COCO 모델 가동 (YOLO 내부에서 자동으로 imgsz=640 전처리 후 탐지 수행)
        # ※ conf=0.9는 그릇을 너무 못 잡을 수 있어 프로덕션 안정성을 위해 0.5로 완화 조치했습니다.
        coco_results = coco_yolo.predict(original_img, imgsz=640, conf=0.5, iou=0.4, classes=[45, 55])
        
        # [A] 그릇/접시가 1개 이상 발견된 경우 -> [한식 파이프라인 (EfficientNet-B2)]
        # if coco_results[0].boxes and len(coco_results[0].boxes) > 0:
        if coco_results[0].boxes and len(coco_results[0].boxes) > 1:
            print(f"그릇/접시 {len(coco_results[0].boxes)}개 감지됨 -> 한식 모델(EfficientNet-B2) 가동")
            hansik_unique_dict = {}
            
            for i, box in enumerate(coco_results[0].boxes):
                xyxy = box.xyxy[0].tolist()
                
                margin = 20 
                img_w, img_h = original_img.size
                x1 = max(0, xyxy[0] - margin)
                y1 = max(0, xyxy[1] - margin)
                x2 = min(img_w, xyxy[2] + margin)
                y2 = min(img_h, xyxy[3] + margin)

                # 원본에서 그릇 영역 크롭
                cropped = original_img.crop((x1, y1, x2, y2))
                
                # 변경 포인트: 크롭된 이미지를 찌그러뜨리지 않고 패딩하여 288x288로 만듦
                padded_cropped = padding_preprocess(cropped, target_size=288)
                
                crop_filename = f"{uuid.uuid4()}_bowl_{i}.jpg"
                crop_path = os.path.join(UPLOAD_DIR, crop_filename)
                padded_cropped.save(crop_path, "JPEG")
                
                # 텐서 변환 및 EfficientNet 추론
                input_tensor = classify_tensor_transform(padded_cropped).unsqueeze(0).to(device)
                with torch.no_grad():
                    output = classifier(input_tensor)
                    probs = torch.nn.functional.softmax(output, dim=1)
                    conf_val, idx = torch.max(probs, 1)
                    current_conf = conf_val.item()
                    
                f_info = FOOD_NUTRITION_DB.get(idx.item())
                if f_info:
                    food_name = f_info["name"]
                    conf_percent = round(current_conf * 100, 2)
                    print(f"[한식 후보] 인덱스 {idx.item()}: {food_name} (확신도: {conf_percent}%)")
                    
                    if food_name in hansik_unique_dict:
                        if conf_percent <= hansik_unique_dict[food_name]["confidence"]:
                            continue 
                            
                    assigned_weight = get_default_weight(food_name)
                    # ratio = assigned_weight / 100.0

                    # 💡 안전한 float 변환용 헬퍼 계산 (NaN일 경우 0.0 처리)
                    safe_kcal = f_info["kcal"] if not math.isnan(f_info["kcal"]) else 0.0
                    safe_carbs = f_info["carbs"] if not math.isnan(f_info["carbs"]) else 0.0
                    safe_protein = f_info["protein"] if not math.isnan(f_info["protein"]) else 0.0
                    safe_fat = f_info["fat"] if not math.isnan(f_info["fat"]) else 0.0
                    
                    # [핵심 변경] 칼탄단지는 100g당 원본 데이터를 그대로 보냅니다!
                    # 프론트엔드에서는 이 원본 데이터와 weight를 받아서 화면에 (영양소 * weight / 100)으로 보여주어야 합니다.
                    hansik_unique_dict[food_name] = {
                        "food_name": food_name,
                        "confidence": conf_percent if not math.isnan(conf_percent) else 0.0, # 확신도 방어
                        "weight": assigned_weight,  
                        "calories": round(safe_kcal, 1),     
                        "carbs": round(safe_carbs, 1),       
                        "protein": round(safe_protein, 1),   
                        "fat": round(safe_fat, 1),           
                        "image_url": f"/static/uploads/food/{crop_filename}"
                    }        
            # 💡 기존 음식 리스트와 함께, 분석에 사용된 전체 메인 이미지 파일명을 같이 묶어서 보냅니다.
            # (main_filename 변수명은 사용 중이신 전체 메인 이미지 변수명으로 매칭해주세요!)

            response_data = {
                "main_image_url": f"/static/uploads/food/{main_filename}", # 👈 전체 메인 이미지 경로 추가
                "items": list(hansik_unique_dict.values())               # 👈 기존 음식 리스트는 items로 포장
            }

            return response_data
                    
        # [B] 그릇/접시가 발견되지 않은 경우 -> [헬스식단 파이프라인 (유저님의 YOLO 모델)]
        else:
            # 로그 출력을 상황에 맞게 조금 더 직관적으로 수정해 두면 모니터링하기 좋습니다.
            detected_count = len(coco_results[0].boxes) if coco_results[0].boxes else 0
            print(f"🍃 그릇이 {detected_count}개 감지됨 (1개 이하) -> 헬스식단 전용 YOLO 모델 가동")
            # print("그릇이 감지되지 않음 -> 헬스식단 전용 YOLO 모델 가동")
            diet_results = diet_yolo.predict(original_img, imgsz=640, conf=0.5, iou=0.4, classes=[0,1,2,3,4,5,6,7,8,9,10])
            diet_unique_dict = {}
            
            if diet_results[0].boxes and len(diet_results[0].boxes) > 0:
                for i, box in enumerate(diet_results[0].boxes):
                    cls_id = int(box.cls.item())
                    conf_percent = round(box.conf.item() * 100, 2)
                    xyxy = box.xyxy[0].tolist()                    
                    food_name = DIET_CLASSES_MAP.get(cls_id, "알 수 없는 음식")
                    print(f"[헬스식단 후보] 클래스 {cls_id}: {food_name} (확신도: {conf_percent}%)")
                    
                    if food_name in diet_unique_dict:
                        if conf_percent <= diet_unique_dict[food_name]["confidence"]:
                            continue 
                    
                    # 헬스 식단 크롭물도 비율 유지하여 보관용 패딩 처리 가능
                    cropped = original_img.crop((xyxy[0], xyxy[1], xyxy[2], xyxy[3]))
                    padded_cropped = padding_preprocess(cropped, target_size=288)
                    
                    crop_filename = f"{uuid.uuid4()}_diet_{i}.jpg"
                    crop_path = os.path.join(UPLOAD_DIR, crop_filename)
                    padded_cropped.save(crop_path, "JPEG")
                    
                    target_nutrition = FOOD_MASTER_DF[FOOD_MASTER_DF["식품명"].str.contains(food_name, na=False, regex=False)]
                    
                    if not target_nutrition.empty:
                        nutri = target_nutrition.iloc[0]
                        kcal = float(nutri["에너지(kcal)"])
                        carbs = float(nutri["탄수화물(g)"])
                        protein = float(nutri["단백질(g)"])
                        fat = float(nutri["지방(g)"])
                    else:
                        kcal, carbs, protein, fat = 0, 0, 0, 0
                    
                    assigned_weight = get_default_weight(food_name)
                    # ratio = assigned_weight / 100.0
                        
                    # 💡 안전한 float 변환용 헬퍼 계산 (NaN일 경우 0.0 처리)
                    safe_kcal = kcal if not math.isnan(kcal) else 0.0
                    safe_carbs = carbs if not math.isnan(carbs) else 0.0
                    safe_protein = protein if not math.isnan(protein) else 0.0
                    safe_fat = fat if not math.isnan(fat) else 0.0

                    diet_unique_dict[food_name] = {
                        "food_name": food_name,
                        "confidence": conf_percent if not math.isnan(conf_percent) else 0.0, # 확신도 방어
                        "weight": assigned_weight, 
                        "calories": round(safe_kcal, 1),
                        "carbs": round(safe_carbs, 1),
                        "protein": round(safe_protein, 1),
                        "fat": round(safe_fat, 1),
                        "image_url": f"/static/uploads/food/{crop_filename}"
                    }
                    
                health_items = list(diet_unique_dict.values())
            else:
                print("두 모델 모두에서 아무 음식/그릇도 찾지 못했습니다.")
        # 메인 전체 이미지 경로도 포함해서 리턴 (프론트가 쓸 수 있게 구조화 가능)
        # 2. 한식과 완전히 동일한 '통합 포장 규격'으로 데이터를 감쌉니다.
        response_data = {
            "main_image_url": f"/static/uploads/food/{main_filename}", # 👈 전체 메인 이미지 경로 (한식과 동일)
            "items": health_items                                      # 👈 헬스식단 리스트를 items에 매립
        }

        return response_data
        
    except Exception as e:
        print(f"Error in /analyze: {e}")
        raise HTTPException(status_code=500, detail="분석 실패")

@router.post("/record-many")
def record_many_diet(data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    items = data.get("items", [])
    meal_type = data.get("meal_type")
    group_id = data.get("group_id") 
    image_url = data.get("image_url")  
    save_as_fav = data.get("save_as_favorite", False) 
    today = date.today()

    try:
        # 메인 이미지 영구 저장소로 이동
        final_main_image_url = move_image_to_save_dir(image_url)

        if meal_type in ['아침', '점심', '저녁']:
            db.query(DietLog).filter(DietLog.user_id == current_user.id, DietLog.date == today, DietLog.meal_type == meal_type).delete()
        else: 
            if group_id:
                db.query(DietLog).filter(DietLog.user_id == current_user.id, DietLog.entry_group_id == group_id).delete()

        for item in items:
            food_name = item.get("food_name")
            
            # [프론트엔드 100g 고정 버그 방어막]
            # 프론트에서 weight를 안 보냈거나 잘못 보냈다면 백엔드 엔진 규칙(get_default_weight)을 다시 적용합니다.
            client_weight = item.get("weight", 100)
            if client_weight == 100 or client_weight == 0:
                assigned_weight = get_default_weight(food_name)
            else:
                assigned_weight = client_weight

            new_log = DietLog(
                user_id=current_user.id,
                food_name=food_name,
                # 100g당 원본 영양소 저장
                calories=item.get("calories", 0),
                carbs=item.get("carbs", 0),
                protein=item.get("protein", 0),
                fat=item.get("fat", 0),
                weight=assigned_weight,
                meal_type=meal_type,
                entry_group_id=group_id, 
                image_url=final_main_image_url,  # 📍 복사된 save 폴더 이미지 주소 저장   
                date=today,
                is_favorite=1 if save_as_fav else 0 
            )
            db.add(new_log)
        db.commit()
        return {"status": "success", "message": "식단이 성공적으로 저장되었습니다."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/daily-summary")
def get_daily_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    logs = db.query(DietLog).filter(DietLog.user_id == current_user.id, DietLog.date == date.today()).all()
    
    # 🌟 [총합 계산 로직 일원화]
    # DB에 저장된 100g당 수치에 실제 저장된 매 끼니의 weight 비율을 곱해 합산합니다.
    total_data = {
        "kcal": round(sum((l.calories * (l.weight / 100.0)) for l in logs), 1),
        "carbs": round(sum((l.carbs * (l.weight / 100.0)) for l in logs), 1),
        "protein": round(sum((l.protein * (l.weight / 100.0)) for l in logs), 1),
        "fat": round(sum((l.fat * (l.weight / 100.0)) for l in logs), 1)
    }
    
    # 참고: logs 목록 자체는 프론트엔드에 그대로 넘어가므로, 
    # 프론트엔드 개발자분에게 화면단 찌개 카드의 칼탄단지 텍스트를 렌더링할 때도 
    # {log.calories * (log.weight / 100)} 로 계산해서 띄워달라고 요청하시면 완벽합니다!
    return {"total": total_data, "logs": logs}

@router.get("/favorites")
def get_favorites_categorized(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    fav_logs = db.query(DietLog).filter(DietLog.user_id == current_user.id, DietLog.is_favorite == 1).order_by(DietLog.created_at.desc()).all()
    result = {"meal": [], "snack": []}
    sets = {}

    for log in fav_logs:
        group_key = log.image_url if log.image_url else log.created_at.strftime("%Y-%m-%d %H:%M")
        if group_key not in sets:
            sets[group_key] = {"meal_type": log.meal_type, "image_url": log.image_url, "items": []}
        sets[group_key]["items"].append({
            "food_name": log.food_name, "calories": log.calories, "carbs": log.carbs,
            "protein": log.protein, "fat": log.fat, "weight": log.weight
        })

    for key, s in sets.items():
        category = "snack" if s["meal_type"] == "간식" else "meal"
        result[category].append(s)
    return result

@router.post("/feedback")
def get_diet_feedback(items: list):
    total_protein = sum(item.get('protein', 0) for item in items)
    if total_protein < 20:
        return {"feedback": "단백질이 조금 부족해요! 닭가슴살이나 달걀을 추가해보면 어떨까요?"}
    return {"feedback": "영양 구성이 아주 훌륭한 식단입니다! 이대로 유지하세요."}

@router.get("/today-summary")
def get_today_diet_summary(db: Session = Depends(get_db)):
    today = datetime.now().date()
    summary = db.query(
        func.sum(DietLog.calories).label("total_cal"), func.sum(DietLog.protein).label("total_protein")
    ).filter(func.date(DietLog.created_at) == today).first()
    return {"calories": summary.total_cal or 0, "protein": summary.total_protein or 0}