from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from pydantic import BaseModel
from typing import List, Dict, Optional
from datetime import date as date_t
import numpy as np
import os
import tempfile
from sqlalchemy.orm import Session
from app.core.constants import EXERCISE_CATEGORIES, CAMERA_GUIDE, FEEDBACK_MESSAGES, GUIDE_IMAGES
from app.database import get_db
from app.models.formcheck_log import FormCheckLog
from app.models.user import User
from app.api.v1.endpoints.auth import get_current_user
import httpx

router = APIRouter()

# 운동 분류 사이드카(3.10 venv / sklearn 1.3.2)의 주소. 메인은 sklearn 1.8이라
# 모델을 직접 못 돌리므로 이 서비스에 프레임 분류를 위임한다.
MODEL_SERVICE_URL = os.environ.get("MODEL_SERVICE_URL", "http://127.0.0.1:8002")
_model_client = httpx.AsyncClient(timeout=2.0)

# 영상 분석 사이드카(YOLO+MediaPipe+모델/룰, 3.10 venv). 업로드 영상을 통째로 위임.
VIDEO_SERVICE_URL = os.environ.get("VIDEO_SERVICE_URL", "http://127.0.0.1:8003")

# 전역 상태 (메모리 관리)
error_counts = {}
total_frames = 0
model_frames = 0         # 모델이 실제로 판정한 프레임 수 (점수 계산 분모)

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
    global error_counts, total_frames, model_frames, orient_clear, orient_contradict
    landmarks = data.landmarks
    total_frames += 1

    # 1. 초기 가이드 문구 보장
    guide_text = CAMERA_GUIDE.get(data.exercise_type, "카메라를 고정하고 전신이 나오게 해주세요.")

    if not landmarks or len(landmarks) < 33:
        return {"guide": guide_text, "exercise_match": True, "exercise_supported": True}

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

    # 모델 사이드카(3.10 venv)에 프레임 분류 요청
    try:
        resp = await _model_client.post(
            f"{MODEL_SERVICE_URL}/predict",
            json={"landmarks": landmarks, "exercise_type": data.exercise_type},
        )
        pred = resp.json()
    except Exception:
        pred = None

    # 사이드카 연결 실패 → 일시 오류 안내(점수 없음)
    if pred is None:
        return {"guide": guide_text, "exercise_match": exercise_match,
                "exercise_supported": True, "analysis_error": True,
                "overall": "분석 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요."}

    # 모델 없는 운동(15종) → '정밀 분석 준비 중'으로 프론트가 처리
    if not pred.get("available"):
        return {"guide": guide_text, "exercise_match": exercise_match,
                "exercise_supported": False}

    # --- 모델 예측 기반 집계 ---
    error = pred.get("error") or "correct"   # 사이드카가 그룹 확률로 판정한 verdict
    model_errors = pred.get("errors", [])
    approx = bool(pred.get("approx"))
    model_frames += 1

    current_error = None
    feedback_points = []
    error_severity = 0.0
    if error and error != "correct":
        current_error = error
        error_counts[error] = error_counts.get(error, 0) + 1
        error_severity = round(float(pred.get("proba", 0.0)), 4)  # 예측 신뢰도 = 심각도 proxy
        for idx in ERROR_BODY_PARTS.get(error, []):
            feedback_points.append({"x": landmarks[idx * 4], "y": landmarks[idx * 4 + 1]})

    # 이 운동이 '평가하는' 카테고리 = 모델이 보는 에러들의 카테고리만 (측정 안 하는 항목은 노출 X)
    evaluated_cats = []
    for e in model_errors:
        c = ERROR_CATEGORY_MAP.get(e)
        if c and c not in evaluated_cats:
            evaluated_cats.append(c)

    # 점수: 에러가 '지속적'일 때만 감점. 소수 프레임의 일시적 오탐은 정상으로 본다.
    PROBLEM_RATIO = 0.30  # 전체 프레임의 30% 이상 잡혀야 실제 문제로 인정
    denom = max(model_frames, 1)
    cat_scores = {}
    cat_details = {}
    for cat in evaluated_cats:
        cat_err_keys = [e for e in model_errors if ERROR_CATEGORY_MAP.get(e) == cat]
        cat_err_total = sum(error_counts.get(e, 0) for e in cat_err_keys)
        ratio = cat_err_total / denom
        worst = max(cat_err_keys, key=lambda e: error_counts.get(e, 0), default=None)
        if ratio >= PROBLEM_RATIO and worst:
            cat_scores[cat] = max(45, int(round(100 - (ratio - PROBLEM_RATIO) * 90 - 15)))
            cat_details[cat] = FEEDBACK_MESSAGES.get(worst, "자세를 점검해 보세요.")
        else:
            cat_scores[cat] = max(88, int(round(100 - ratio * 20)))  # 사실상 정상 → 거의 만점
            cat_details[cat] = CATEGORY_PRAISE.get(cat, "좋습니다.")

    total_score = int(round(sum(cat_scores.values()) / len(cat_scores))) if cat_scores else 100

    overall = f"{total_score}점 — 자세 분석 완료."
    if approx:
        overall += " (근사 분석)"

    return {
        "score": total_score,
        "exercise_match": exercise_match,   # False면 프론트가 '운동 불일치' 화면 표시
        "exercise_supported": True,
        "approx": approx,                   # 변형 매핑(근사 분석) 여부
        "error_key": current_error,
        "error_severity": error_severity,   # 가장 심한 프레임 선별용
        "error_category": ERROR_CATEGORY_MAP.get(current_error) if current_error else None,
        "feedback_points": feedback_points,
        "guide": guide_text,
        "overlay_message": OVERLAY_MESSAGES.get(current_error, ""),
        "overall": overall,
        "cat_scores": cat_scores,
        "cat_details": cat_details,
    }

@router.post("/reset")
async def reset_counter():
    global error_counts, total_frames, model_frames, orient_clear, orient_contradict
    total_frames, model_frames, error_counts = 0, 0, {}
    orient_clear, orient_contradict = 0, 0
    return {"status": "success"}


@router.get("/analyze_progress")
async def analyze_progress(job_id: str):
    """분석 진행률(%)을 사이드카에서 받아 중계. 프론트가 폴링한다."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{VIDEO_SERVICE_URL}/progress", params={"job_id": job_id})
        return resp.json()
    except Exception:
        return {"percent": 0}


@router.post("/analyze_video")
async def analyze_video_proxy(
    exercise_type: str = Form(...),
    file: UploadFile = File(...),
    job_id: str = Form(""),
):
    """업로드된 운동 영상을 임시 저장 후, 영상 분석 사이드카(8003)에 위임하고 결과를 중계.
    사이드카가 YOLO 크롭 + MediaPipe + 모델/룰 + 이벤트 점수까지 수행한다."""
    suffix = os.path.splitext(file.filename or "")[1] or ".mp4"
    fd, path = tempfile.mkstemp(suffix=suffix)
    with os.fdopen(fd, "wb") as f:
        f.write(await file.read())
    try:
        async with httpx.AsyncClient(timeout=600.0) as client:
            resp = await client.post(
                f"{VIDEO_SERVICE_URL}/analyze_video",
                json={"video_path": path, "exercise_type": exercise_type, "job_id": job_id},
            )
        return resp.json()
    except Exception as e:
        return {"analysis_error": True, "exercise_supported": True,
                "overall": f"분석 서비스에 연결하지 못했습니다: {e}"}
    finally:
        try:
            os.remove(path)
        except OSError:
            pass


# --- 폼체크 결과 저장 (로그인 유저 계정에 기록) ---

class FormCheckLogCreate(BaseModel):
    exercise_type: str
    score: float
    rep_count: Optional[int] = None
    cat_scores: Optional[Dict[str, float]] = None
    cat_details: Optional[Dict[str, str]] = None
    overall: Optional[str] = None
    date: Optional[str] = None  # YYYY-MM-DD (클라이언트 로컬 날짜). 없으면 서버 오늘


@router.post("/formcheck/log")
def save_formcheck_log(
    data: FormCheckLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """analyze_video 로 받은 폼체크 결과를 로그인 유저의 그날 기록으로 저장한다.
    분석 엔드포인트(analyze_video)는 무인증을 유지하고, 저장만 여기서 인증한다."""
    try:
        logged = date_t.fromisoformat(data.date) if data.date else date_t.today()
    except ValueError:
        logged = date_t.today()

    log = FormCheckLog(
        user_id=current_user.id,
        logged_date=logged,
        exercise_type=data.exercise_type,
        score=data.score,
        rep_count=data.rep_count,
        cat_scores=data.cat_scores,
        cat_details=data.cat_details,
        overall=data.overall,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return {"status": "success", "id": log.id}