from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
import numpy as np
from fastapi import APIRouter
import os
from app.core.constants import EXERCISE_CATEGORIES, CAMERA_GUIDE, FEEDBACK_MESSAGES, GUIDE_IMAGES

router = APIRouter()

# 전역 상태 (메모리 관리)
counter = 0
stage = "ready"
error_counts = {}
total_frames = 0

YOLO_WEIGHTS_PATH = "./models/exercise/best_big_bounding.pt"
EXERCISE_MODEL_PATHS = {
    "벤치프레스": "./models/exercise/benchpress.pkl",
    "스쿼트": "./models/exercise/squat.pkl",
    "데드리프트": "./models/exercise/deadlift.pkl",
}

@router.get("/list")
async def get_exercise_list():
    """부위별 운동 목록과 각 운동별 상세 가이드(사진 경로 포함) 반환"""
    return {
        "categories": EXERCISE_CATEGORIES,
        "guides": CAMERA_GUIDE,
        # 프론트엔드 assets 폴더와 매칭될 이미지 파일명
        "images": {
            "스쿼트": "squat_guide.jpg",
            "벤치프레스": "bench_guide.jpg",
            "데드리프트": "dead_guide.jpg",
            # ...
        }
    }

# 3. 가이드 이미지 경로 설정
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
GUIDE_IMAGES_DIR = os.path.join(BASE_DIR, "data", "guide_images")

@router.get("/exercises")
async def get_exercises():
    """프론트엔드에서 부위별 운동 선택창을 만들 때 사용"""
    return {
        "categories": EXERCISE_CATEGORIES,
        "guides": CAMERA_GUIDE
    }

@router.get("/info")
async def get_exercise_info():
    """모든 운동 카테고리, 가이드 문구, 이미지 경로를 한 번에 전달"""
    return {
        "categories": EXERCISE_CATEGORIES,
        "guides": CAMERA_GUIDE,
        "images": GUIDE_IMAGES
    }

ERROR_KEYS = list(FEEDBACK_MESSAGES.keys())

ERROR_CATEGORY_MAP = {
    "excessive_arch": "Posture",
    "spine_neutral": "Posture",
    "arms_spread": "Movement Quality",
    "arms_narrow": "Movement Quality",
    "caved_in_knees": "Stability",
    "feet_spread": "Stability",
}

CATEGORY_ORDER = ["Stability", "ROM", "Movement Quality", "Posture", "Core"]

CATEGORY_LABELS = {
    "Stability": "Stability(안정성)",
    "ROM": "Range of Motion(가동범위)",
    "Movement Quality": "Movement Quality(동작 품질)",
    "Posture": "Posture(자세)",
    "Core": "Bracing & Core(코어 긴장)",
}

CATEGORY_PRAISE = {
    "Stability": "균형감 좋습니다.",
    "ROM": "깊이 충분히 내려갑니다. 좋아요.",
    "Movement Quality": "동작 컨트롤이 매끄럽습니다.",
    "Posture": "척추 중립이 잘 유지됩니다.",
    "Core": "복압 거의 완벽합니다.",
}

OVERLAY_MESSAGES = {
    "excessive_arch": "허리 아치 과도",
    "arms_spread": "그립 너무 넓음",
    "arms_narrow": "그립 너무 좁음",
    "spine_neutral": "척추 비중립",
    "caved_in_knees": "무릎 안쪽 꺾임",
    "feet_spread": "보폭이 너무 넓습니다",
}

ERROR_BODY_PARTS = {
    "feet_spread": [27, 28],
    "caved_in_knees": [25, 26],
    "arms_spread": [15, 16],
    "arms_narrow": [15, 16],
    "excessive_arch": [23, 24],
    "spine_neutral": [11, 12, 23, 24],
}

CATEGORY_HINTS = {
    "Stability": "발 가운데로 무게중심을 두고 좌우 흔들림을 줄여보세요.",
    "ROM": "rep 사이 깊이가 일정하지 않습니다. 매번 같은 깊이까지 컨트롤하면서 내려가세요.",
    "Movement Quality": "하강·상승 템포를 일정하게(예: 3초 내려가고 1초 올라오기) 유지하세요.",
    "Posture": "가슴을 천장 쪽으로 들고 시선을 정면 한 점에 고정해 척추 중립을 유지하세요.",
    "Core": "복압을 더 강하게 잡고 호흡 타이밍을 의식적으로 맞춰보세요.",
}

# --- 운동-종류 검증(몸통 방향 기반) ----------------------------------------
# 방향이 '명확한' 운동만 게이팅한다. 인클라인 벤치/바벨 로우처럼 몸통이 대각선이라
# 애매한 운동은 오판(정상 영상을 거절)을 막기 위해 검증에서 제외(=항상 통과)한다.
UPRIGHT_EXERCISES = {  # 몸통 수직(서거나 앉은 자세)
    "스쿼트", "데드리프트", "런지", "스모 데드리프트", "오버헤드 프레스",
    "사이드 레터럴 레이즈", "프론트 레이즈", "바벨 컬", "랫풀다운", "머신플라이",
}
LYING_EXERCISES = {  # 몸통 수평(누운 자세)
    "벤치프레스", "클로즈 그립 벤치프레스", "라잉 트라이셉스 익스텐션",
    "레그 레이즈", "크런치", "플랭크",
}

# 검증용 전역 상태 (메모리)
orient_clear = 0       # 방향이 뚜렷하게 잡힌 프레임 수
orient_contradict = 0  # 그 중 기대 방향과 반대로 나온 프레임 수


def _torso_orientation(landmarks):
    """어깨(11,12)·엉덩이(23,24) 중점을 잇는 몸통선의 방향.
    반환: 'vertical' | 'horizontal' | None(신뢰도 낮거나 대각선이라 애매)."""
    try:
        sx = (landmarks[11 * 4] + landmarks[12 * 4]) / 2
        sy = (landmarks[11 * 4 + 1] + landmarks[12 * 4 + 1]) / 2
        hx = (landmarks[23 * 4] + landmarks[24 * 4]) / 2
        hy = (landmarks[23 * 4 + 1] + landmarks[24 * 4 + 1]) / 2
        sv = min(landmarks[11 * 4 + 3], landmarks[12 * 4 + 3])
        hv = min(landmarks[23 * 4 + 3], landmarks[24 * 4 + 3])
    except IndexError:
        return None
    if sv < 0.4 or hv < 0.4:  # 어깨/엉덩이가 충분히 안 보이면 판단 보류
        return None
    dx = abs(sx - hx)
    dy = abs(sy - hy)
    if dy > dx * 1.3:
        return "vertical"
    if dx > dy * 1.3:
        return "horizontal"
    return None  # 대각선 ~45° → 카운트하지 않음


class ExerciseData(BaseModel):
    landmarks: List[float]
    exercise_type: str = "스쿼트"

def _exercise_match_verdict():
    """누적된 방향 통계로 '선택 운동 일치 여부' 판정. 증거가 충분하고
    모순 비율이 높을 때만 False(불일치). 그 전에는 항상 True(무죄추정)."""
    if orient_clear >= 8 and (orient_contradict / orient_clear) > 0.6:
        return False
    return True


@router.post("/analyze")
async def analyze_exercise(data: ExerciseData):
    global counter, stage, error_counts, total_frames, orient_clear, orient_contradict
    landmarks = data.landmarks
    total_frames += 1

    # 1. 초기 가이드 문구 보장
    guide_text = CAMERA_GUIDE.get(data.exercise_type, "카메라를 고정하고 전신이 나오게 해주세요.")

    if not landmarks or len(landmarks) < 33:
        return {"counter": counter, "guide": guide_text, "angle": 0, "exercise_match": True}

    # 운동-종류 검증: 방향이 명확한 운동만, 강한 모순이 누적될 때 불일치로 판정
    expected = "vertical" if data.exercise_type in UPRIGHT_EXERCISES else (
        "horizontal" if data.exercise_type in LYING_EXERCISES else None)
    if expected is not None:
        ori = _torso_orientation(landmarks)
        if ori is not None:
            orient_clear += 1
            if ori != expected:
                orient_contradict += 1
    exercise_match = _exercise_match_verdict()

    try:
        step = 4
        hip = [landmarks[24*step], landmarks[24*step+1]]
        knee = [landmarks[26*step], landmarks[26*step+1]]
        ankle = [landmarks[28*step], landmarks[28*step+1]]
        
        # 각도 계산 (numpy)
        a, b, c = np.array(hip), np.array(knee), np.array(ankle)
        radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
        angle = np.abs(radians * 180.0 / np.pi)
        if angle > 180.0: angle = 360 - angle

        # 카운팅
        if angle < 120: stage = "down"
        elif angle > 160 and stage == "down":
            stage = "up"
            counter += 1

        # 에러 판정 및 좌표 추출 로직 강화
        current_error = None
        feedback_points = [] # 프론트엔드에 전달할 좌표 리스트
        error_severity = 0.0  # 0이면 정상, 클수록 심함 — 프론트가 '가장 심한 프레임' 선택에 사용

        # 예시: 무릎 꺾임 에러 발생 시
        if angle < 130 and abs(knee[0] - ankle[0]) > 0.05:
            current_error = "caved_in_knees"
            error_severity = round(abs(knee[0] - ankle[0]), 4)  # 무릎-발목 수평 이격 → 클수록 더 안쪽으로 꺾임
            error_counts[current_error] = error_counts.get(current_error, 0) + 1
            
            # 모델 담당자가 정의한 ERROR_BODY_PARTS에 따라 좌표 추출 (무릎: 25, 26)
            # landmarks는 [x, y, z, v, x, y, z, v...] 형태이므로 4씩 곱해서 접근
            indices = ERROR_BODY_PARTS.get("caved_in_knees", [])
            for idx in indices:
                feedback_points.append({
                    "x": landmarks[idx * 4],
                    "y": landmarks[idx * 4 + 1]
                })

        # 관대한 점수 (최하 65점 보장)
        penalty = (len(error_counts) * 5) + ( (sum(error_counts.values())/total_frames)*30 if total_frames > 0 else 0 )
        total_score = max(65, int(100 - penalty))

        return {
            "counter": counter,
            "angle": round(angle, 1),
            "score": total_score,
            "exercise_match": exercise_match,  # False면 프론트가 점수 대신 '운동 불일치' 화면 표시
            "error_key": current_error,
            "error_severity": error_severity,  # 가장 심한 프레임 선별용
            "error_category": ERROR_CATEGORY_MAP.get(current_error) if current_error else None,  # 어느 진단 섹터의 스크린샷인지
            "feedback_points": feedback_points, # 이 좌표를 리액트가 사용함
            "guide": guide_text,
            "overlay_message": OVERLAY_MESSAGES.get(current_error, ""), # 화면 상단 노출용
            "overall": f"{counter}회 완료! {total_score}점.",
            "cat_scores": {
                "Stability": max(70, 100 - (error_counts.get("caved_in_knees", 0) * 2)),
                "Posture": 95, 
                "ROM": 100 if angle < 100 else 85,
                "Movement Quality": 90,
                "Core": 88
            },
            "cat_details": {
                "Stability": FEEDBACK_MESSAGES["caved_in_knees"] if "caved_in_knees" in error_counts else "하체 중심이 견고합니다.",
                "Posture": "상체 각도가 아주 안정적입니다.",
                "ROM": "가동 범위가 충분합니다.",
                "Movement Quality": "하강 속도가 일정하여 근육의 긴장이 잘 유지됩니다.",
                "Core": "복압 유지가 잘 되어 허리 부담이 적습니다."
            }
        }
    except Exception:
        return {"counter": counter, "guide": guide_text, "exercise_match": exercise_match}

@router.post("/reset")
async def reset_counter():
    global counter, stage, error_counts, total_frames, orient_clear, orient_contradict
    counter, stage, total_frames, error_counts = 0, "ready", 0, {}
    orient_clear, orient_contradict = 0, 0
    return {"status": "success"}