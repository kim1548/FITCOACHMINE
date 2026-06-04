"""운동 자세 분류 사이드카 서비스 (포트 8002).

Python 3.10 venv(scikit-learn 1.3.2)에서 구동된다. 메인 백엔드(3.14)는
sklearn 1.8 때문에 모델을 못 돌리므로, 이 서비스가 3대 모델을 로드해
프레임 랜드마크(132개)를 분류해주고 메인 백엔드가 /predict 로 호출한다.

실행:  .venv310/Scripts/python.exe -m uvicorn model_service:app --port 8002
"""
import os
import pickle
import warnings
from typing import List

import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel

warnings.filterwarnings("ignore")  # 1.3.0 vs 1.3.2 패치버전 경고 억제(출력은 유효)

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app", "models", "exercise")

MODEL_FILES = {
    "squat": "squat.pkl",
    "benchpress": "benchpress.pkl",
    "deadlift": "deadlift.pkl",
}

# 운동 종류 -> 사용할 모델. 변형은 가장 가까운 base 모델로 '근사' 매핑.
MODEL_FOR_EXERCISE = {
    "스쿼트": "squat",
    "벤치프레스": "benchpress",
    "데드리프트": "deadlift",
    # --- 근사 매핑 (변형) ---
    "인클라인 벤치프레스": "benchpress",
    "클로즈 그립 벤치프레스": "benchpress",
    "스모 데드리프트": "deadlift",
}
EXACT_EXERCISES = {"스쿼트", "벤치프레스", "데드리프트"}

# 각 모델이 실제로 평가하는 에러(=classes_ 에서 correct/phase 제거). 메인 백엔드가
# '이 운동이 어떤 카테고리를 평가하는지' 판단하는 데 쓴다.
MODEL_ERRORS = {
    "squat": ["caved_in_knees", "feet_spread", "spine_neutral"],
    "benchpress": ["arms_spread", "excessive_arch"],
    "deadlift": ["arms_narrow", "arms_spread", "spine_neutral"],
}

models = {}
app = FastAPI()


@app.on_event("startup")
def load_models():
    for key, fn in MODEL_FILES.items():
        with open(os.path.join(BASE, fn), "rb") as f:
            models[key] = pickle.load(f)
    print(f"[model_service] loaded models: {list(models)}")


class PredictReq(BaseModel):
    landmarks: List[float]
    exercise_type: str


def _parse_label(label: str):
    """'s_caved_in_knees_down' -> ('caved_in_knees', 'down'). 'b_correct_up' -> ('correct','up')."""
    parts = label.split("_")
    phase = parts[-1]                 # down / up
    error = "_".join(parts[1:-1])     # 앞 prefix(s/b/d) + 뒤 phase 제거
    return error, phase


@app.get("/health")
def health():
    return {"status": "ok", "models": list(models)}


@app.post("/predict")
def predict(req: PredictReq):
    model_key = MODEL_FOR_EXERCISE.get(req.exercise_type)
    if model_key is None or model_key not in models:
        return {"available": False}  # 모델 없는 운동 -> 메인이 '준비 중' 처리

    if len(req.landmarks) != 132:
        return {"available": True, "error": "correct", "proba": 0.0, "correct_proba": 1.0,
                "model": model_key, "errors": MODEL_ERRORS[model_key],
                "approx": req.exercise_type not in EXACT_EXERCISES}

    m = models[model_key]
    X = np.array([req.landmarks], dtype=float)
    proba_vec = m.predict_proba(X)[0]

    # 8개 세부클래스(에러x{down,up})를 phase 무시하고 'correct'/에러별로 합산.
    # 세부 argmax는 신뢰도가 낮아(0.2대) 오탐이 잦지만, 그룹 합산은 훨씬 안정적이다.
    groups = {}
    for cls, p in zip(m.classes_, proba_vec):
        err, _phase = _parse_label(str(cls))
        groups[err] = groups.get(err, 0.0) + float(p)
    verdict = max(groups, key=groups.get)  # 'correct' 또는 에러키 (그룹 argmax)

    return {
        "available": True,
        "error": verdict,
        "proba": round(groups[verdict], 4),               # verdict 그룹 확률 (심각도 proxy)
        "correct_proba": round(groups.get("correct", 0.0), 4),
        "model": model_key,
        "errors": MODEL_ERRORS[model_key],                # 이 운동이 평가하는 에러 목록
        "approx": req.exercise_type not in EXACT_EXERCISES,  # 변형(근사 분석) 여부
    }
