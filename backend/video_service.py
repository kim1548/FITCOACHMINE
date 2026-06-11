"""영상 분석 사이드카 (포트 8003) — Python 3.10 venv 구동.

업로드된 운동 영상을 받아 원본 파이프라인(pose_pipeline.analyze_video:
YOLO 크롭 + MediaPipe + 모델/룰 + 이벤트 점수)으로 분석하고,
프론트(FeedbackDetail)가 쓰는 JSON(점수·카테고리·오류별 스크린샷)을 반환한다.

실행:  .venv310/Scripts/python.exe -m uvicorn video_service:app --port 8003
"""
import os
import base64
import bisect
import warnings

warnings.filterwarnings("ignore")

import cv2
import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel
from PIL import Image, ImageDraw

import pose_pipeline as pp

app = FastAPI()

# 속도 위해 frame_skip 상향(원본 기본 3 → 4). YOLO 캐싱과 함께 분석 시간 단축.
FRAME_SKIP = 4
YOLO_CONF = 0.5
PENALTY = 25.0
MIN_DUR = 1.0


class AnalyzeReq(BaseModel):
    video_path: str       # 같은 PC의 임시 영상 경로 (메인 백엔드가 저장 후 전달)
    exercise_type: str
    job_id: str = ""      # 진행률 폴링용 (프론트가 생성)


# 진행률 저장소 {job_id: 0.0~1.0}. 분석 중 프레임 콜백이 갱신, /progress가 읽는다.
_PROGRESS = {}


@app.get("/progress")
def progress(job_id: str):
    return {"percent": round(_PROGRESS.get(job_id, 0.0) * 100)}


@app.on_event("startup")
def _warmup():
    # YOLO를 미리 로드해 '첫 분석'의 콜드스타트(~10초)를 제거한다.
    try:
        pp.load_yolo_model()
        print("[video_service] YOLO 예열 완료")
    except Exception as e:
        print("[video_service] YOLO 예열 실패:", e)


@app.get("/health")
def health():
    return {"status": "ok"}


def _nearest_lm_frame(keys, idx):
    if not keys:
        return None
    pos = bisect.bisect_left(keys, idx)
    if pos == 0:
        return keys[0]
    if pos >= len(keys):
        return keys[-1]
    before, after = keys[pos - 1], keys[pos]
    return before if (idx - before) <= (after - idx) else after


def _render_error_screenshot(video_path, result, key):
    """해당 오류의 '가장 오래 지속된' 이벤트 시작 프레임을 뽑아 빨간 원+라벨을 그려 base64로."""
    groups = result["event_groups"].get(key, [])
    if not groups:
        return None
    ev = max(groups, key=lambda e: e.get("duration_sec", 0.0))
    frame_idx = int(ev["start_frame"])

    lbf = result.get("landmarks_by_frame", {})
    lm_frame = _nearest_lm_frame(sorted(lbf.keys()), frame_idx)
    lm_data = lbf.get(lm_frame) if lm_frame is not None else None

    cap = cv2.VideoCapture(video_path)
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
    ret, frame = cap.read()
    cap.release()
    if not ret:
        return None

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    h, w = rgb.shape[:2]
    img = Image.fromarray(rgb)
    draw = ImageDraw.Draw(img, "RGBA")
    radius = max(22, min(w, h) // 18)

    if lm_data:
        landmarks = lm_data["landmarks"]
        bbox = lm_data["crop_bbox"]
        pts = []
        for li in pp.ERROR_BODY_PARTS.get(key, []):
            p = pp._landmark_to_pixel(landmarks, bbox, li)
            if p is not None:
                pts.append(p)
        # spine_neutral 류는 선으로, 나머지는 속 빈 빨간 링 (부위가 보이게)
        if key in ("spine_neutral", "lean_back") and len(pts) >= 4:
            sx = (pts[0][0] + pts[1][0]) // 2; sy = (pts[0][1] + pts[1][1]) // 2
            hx = (pts[2][0] + pts[3][0]) // 2; hy = (pts[2][1] + pts[3][1]) // 2
            draw.line([(sx, sy), (hx, hy)], fill=(255, 60, 60, 255), width=max(4, h // 140))
            for px, py in [(sx, sy), (hx, hy)]:
                draw.ellipse([px - radius // 2, py - radius // 2, px + radius // 2, py + radius // 2],
                             outline=(255, 60, 60, 255), width=4)
        else:
            for px, py in pts:
                draw.ellipse([px - radius, py - radius, px + radius, py + radius],
                             outline=(255, 60, 60, 255), width=5)

    # (상단 중앙 노란 라벨은 제거 — 문제 부위는 빨간 마커로만 표시하고,
    #  텍스트 피드백은 프론트 결과 화면의 진단 카드에서 보여준다.)

    bgr = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    ok, buf = cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, 88])
    if not ok:
        return None
    return "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode()


def _build_cat_details(cat_scores, event_groups):
    """카테고리별 한 줄 피드백 — 90점 이상은 칭찬, 아니면 가장 두드러진 오류 멘트/힌트."""
    cat_to_errors = {}
    for k in event_groups:
        c = pp.ERROR_CATEGORY_MAP.get(k)
        if c:
            cat_to_errors.setdefault(c, []).append(k)
    details = {}
    for cat in pp.CATEGORY_ORDER:
        sc = cat_scores.get(cat, 100.0)
        if sc >= 90:
            details[cat] = pp.CATEGORY_PRAISE.get(cat, "좋습니다.")
        else:
            errs = cat_to_errors.get(cat, [])
            if errs:
                worst = max(errs, key=lambda k: sum(e["duration_sec"] for e in event_groups.get(k, [])))
                details[cat] = pp.FEEDBACK_MESSAGES.get(worst, pp.CATEGORY_HINTS.get(cat, ""))
            else:
                details[cat] = pp.CATEGORY_HINTS.get(cat, "")
    return details


@app.post("/analyze_video")
def analyze_video_ep(req: AnalyzeReq):
    if req.exercise_type not in pp.EXERCISE_PIPELINES:
        return {"exercise_supported": False, "exercise_match": True}

    def _cb(current, total):
        if req.job_id:
            _PROGRESS[req.job_id] = min(current / max(total, 1), 0.99)

    try:
        result = pp.analyze_video(
            req.video_path, req.exercise_type,
            frame_skip=FRAME_SKIP, yolo_conf=YOLO_CONF, progress_cb=_cb,
        )
        if req.job_id:
            _PROGRESS[req.job_id] = 1.0
    finally:
        # 폴링이 100%를 한 번 받도록 약간의 여지 후 정리는 프론트가 응답받으면 끝나므로 즉시 pop
        pass

    # 운동-종류 불일치(예: 벤치에 스쿼트 영상) → 점수 대신 '불일치' 안내
    if not result.get("exercise_match", True):
        _PROGRESS.pop(req.job_id, None)
        return {"exercise_match": False, "exercise_supported": True}

    score, significant, _filtered = pp.compute_score_from_events(
        result["event_groups"], PENALTY, MIN_DUR, result
    )
    cat_scores = pp.compute_category_scores(result["event_groups"], significant, result, PENALTY)
    overall, top_pct = pp.build_overall_review(
        req.exercise_type, score, result["rep_count"], cat_scores, significant, result["event_groups"]
    )
    cat_details = _build_cat_details(cat_scores, result["event_groups"])

    # 유의미 오류의 카테고리별 대표 스크린샷
    error_frames = {}
    for key in significant:
        cat = pp.ERROR_CATEGORY_MAP.get(key)
        if not cat or cat in error_frames:
            continue
        shot = _render_error_screenshot(req.video_path, result, key)
        if shot:
            error_frames[cat] = {"image": shot, "error_key": key}

    _PROGRESS.pop(req.job_id, None)
    return {
        "score": int(round(score)),
        "exercise_match": True,
        "exercise_supported": True,
        "approx": False,
        "rep_count": int(result["rep_count"]),
        "top_pct": top_pct,
        "overall": overall,
        "cat_scores": {k: int(round(v)) for k, v in cat_scores.items()},
        "cat_details": cat_details,
        "error_frames": error_frames,
        "analyzed_frames": int(result["analyzed_frames"]),
    }
