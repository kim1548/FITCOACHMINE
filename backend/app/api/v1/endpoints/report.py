"""주간 리포트 — 최근 7일 운동·식단·체성분 집계 + Ollama AI 총평.

GET  /weekly      : 빠른 집계 통계 (Journal 상단 카드가 즉시 표시)
POST /weekly/ai   : 집계 기반 AI 총평 생성 (수십 초, 버튼 트리거)
"""
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.routine_log import RoutineLog
from app.models.diet_log import DietLog
from app.models.inbody_log import InBodyLog
from app.api.v1.endpoints.auth import get_current_user
from app.services.weekly_ai import generate_weekly_summary

router = APIRouter()


def _aggregate(db: Session, user_id: int) -> dict:
    today = date.today()
    start = today - timedelta(days=6)  # 최근 7일 (오늘 포함)
    start_dt = datetime.combine(start, time.min)

    # 운동 (RoutineLog: per-user 세션)
    routines = (
        db.query(RoutineLog)
        .filter(RoutineLog.user_id == user_id, RoutineLog.workout_date >= start_dt)
        .all()
    )
    workout_count = len(routines)
    total_volume = sum((r.total_volume or 0) for r in routines)

    # 식단
    diets = (
        db.query(DietLog)
        .filter(DietLog.user_id == user_id, DietLog.date >= start)
        .all()
    )
    diet_days = len({d.date for d in diets})
    avg = lambda total: round(total / diet_days) if diet_days else 0
    avg_calories = avg(sum((d.calories or 0) for d in diets))
    avg_protein = avg(sum((d.protein or 0) for d in diets))
    avg_carbs = avg(sum((d.carbs or 0) for d in diets))
    avg_fat = avg(sum((d.fat or 0) for d in diets))

    # 체성분 (주 시작 대비 변화)
    bodies = (
        db.query(InBodyLog)
        .filter(InBodyLog.user_id == user_id, InBodyLog.measured_at >= start)
        .order_by(InBodyLog.measured_at.asc(), InBodyLog.created_at.asc())
        .all()
    )
    weight_change = body_fat_change = weight_latest = body_fat_latest = None
    if bodies:
        weight_latest = bodies[-1].weight
        body_fat_latest = bodies[-1].body_fat_percent
        if len(bodies) >= 2:
            if bodies[0].weight is not None and bodies[-1].weight is not None:
                weight_change = round(bodies[-1].weight - bodies[0].weight, 1)
            if bodies[0].body_fat_percent is not None and bodies[-1].body_fat_percent is not None:
                body_fat_change = round(bodies[-1].body_fat_percent - bodies[0].body_fat_percent, 1)

    def _fmt(d):
        return f"{d.month}/{d.day}"

    return {
        "period": f"{_fmt(start)} – {_fmt(today)}",
        "workout_count": workout_count,
        "total_volume": round(total_volume, 1),
        "diet_days": diet_days,
        "avg_calories": avg_calories,
        "avg_protein": avg_protein,
        "avg_carbs": avg_carbs,
        "avg_fat": avg_fat,
        "weight_change": weight_change,
        "body_fat_change": body_fat_change,
        "weight_latest": weight_latest,
        "body_fat_latest": body_fat_latest,
        "has_data": bool(workout_count or diet_days or bodies),
    }


@router.get("/weekly")
def weekly(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _aggregate(db, current_user.id)


@router.post("/weekly/ai")
def weekly_ai(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    stats = _aggregate(db, current_user.id)
    summary = generate_weekly_summary(stats, getattr(current_user, "goal", "") or "")
    if summary is None:
        raise HTTPException(status_code=503, detail="AI 총평 생성에 실패했습니다. (Ollama 서버가 응답하지 않습니다.)")
    return {"summary": summary, **stats}
