"""주간 리포트 — 최근 7일 운동·식단·체성분 집계 + Ollama AI 총평.

GET  /weekly      : 빠른 집계 통계 (Journal 상단 카드가 즉시 표시)
POST /weekly/ai   : 집계 기반 AI 총평 생성 (수십 초, 버튼 트리거)
"""
from calendar import monthrange
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
    this_monday = today - timedelta(days=today.weekday())   # 이번 주 월요일
    start = this_monday - timedelta(days=7)                  # 지난주 월요일
    end = start + timedelta(days=6)                          # 지난주 일요일
    start_dt = datetime.combine(start, time.min)
    end_dt = datetime.combine(end, time.max)

    # 운동 (RoutineLog: per-user 세션)
    routines = (
        db.query(RoutineLog)
        .filter(RoutineLog.user_id == user_id,
                RoutineLog.workout_date >= start_dt, RoutineLog.workout_date <= end_dt)
        .all()
    )
    workout_count = len(routines)
    total_volume = sum((r.total_volume or 0) for r in routines)

    # 식단
    diets = (
        db.query(DietLog)
        .filter(DietLog.user_id == user_id, DietLog.date >= start, DietLog.date <= end)
        .all()
    )
    diet_days = len({d.date for d in diets})
    avg = lambda total: round(total / diet_days) if diet_days else 0
    avg_calories = avg(sum((d.calories or 0) for d in diets))
    avg_protein = avg(sum((d.protein or 0) for d in diets))
    avg_carbs = avg(sum((d.carbs or 0) for d in diets))
    avg_fat = avg(sum((d.fat or 0) for d in diets))

    # 체성분 (주간 변화: 창 내 2건이면 첫↔끝, 1건이면 창 직전 측정과 비교)
    bodies = (
        db.query(InBodyLog)
        .filter(InBodyLog.user_id == user_id,
                InBodyLog.measured_at >= start, InBodyLog.measured_at <= end)
        .order_by(InBodyLog.measured_at.asc(), InBodyLog.created_at.asc())
        .all()
    )
    weight_change = body_fat_change = weight_latest = body_fat_latest = None
    if bodies:
        weight_latest = bodies[-1].weight
        body_fat_latest = bodies[-1].body_fat_percent

    def _change(attr):
        vals = [getattr(b, attr) for b in bodies if getattr(b, attr) is not None]
        if len(vals) >= 2:
            return round(vals[-1] - vals[0], 1)
        if len(vals) == 1:
            prev = (
                db.query(InBodyLog)
                .filter(InBodyLog.user_id == user_id,
                        InBodyLog.measured_at < start,
                        getattr(InBodyLog, attr).isnot(None))
                .order_by(InBodyLog.measured_at.desc())
                .first()
            )
            if prev is not None and getattr(prev, attr) is not None:
                return round(vals[-1] - getattr(prev, attr), 1)
        return None

    weight_change = _change("weight")
    body_fat_change = _change("body_fat_percent")

    def _fmt(d):
        return f"{d.month}/{d.day}"

    return {
        "period": f"{_fmt(start)} – {_fmt(end)}",
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


def _scan_session(session_data) -> tuple[float, int, dict]:
    """RoutineLog.session_data(완료 세트 list)를 훑어 (볼륨, 완료세트수, {lift_id: 최고무게}) 반환.

    프로그램 페이지(/routine/log)는 lift별 sets=[{reps, completed}] 형태로 저장한다.
    """
    volume = 0.0
    sets_done = 0
    best: dict[str, float] = {}
    for lift in (session_data or []):
        weight = lift.get("weight") or 0
        lid = lift.get("lift_id") or lift.get("ex")
        for s in (lift.get("sets") or []):
            if s.get("completed", True):
                volume += weight * (s.get("reps") or 0)
                sets_done += 1
        if lid and weight:
            best[lid] = max(best.get(lid, 0.0), weight)
    return volume, sets_done, best


@router.get("/monthly-stats")
def monthly_stats(
    year: int,
    month: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """저널 캘린더 옆 월간 통계 카드용 — 보고 있는 달의 총 세트·볼륨·신규 PR 수."""
    if not (1 <= month <= 12):
        raise HTTPException(status_code=400, detail="month는 1~12 사이여야 합니다.")

    first = date(year, month, 1)
    last = date(year, month, monthrange(year, month)[1])
    start_dt = datetime.combine(first, time.min)
    end_dt = datetime.combine(last, time.max)

    month_logs = (
        db.query(RoutineLog)
        .filter(
            RoutineLog.user_id == current_user.id,
            RoutineLog.workout_date >= start_dt,
            RoutineLog.workout_date <= end_dt,
        )
        .all()
    )
    prior_logs = (
        db.query(RoutineLog)
        .filter(
            RoutineLog.user_id == current_user.id,
            RoutineLog.workout_date < start_dt,
        )
        .all()
    )

    volume = 0.0
    total_sets = 0
    month_best: dict[str, float] = {}
    for log in month_logs:
        v, s, best = _scan_session(log.session_data)
        volume += v
        total_sets += s
        for lid, w in best.items():
            month_best[lid] = max(month_best.get(lid, 0.0), w)

    prior_best: dict[str, float] = {}
    for log in prior_logs:
        _, _, best = _scan_session(log.session_data)
        for lid, w in best.items():
            prior_best[lid] = max(prior_best.get(lid, 0.0), w)

    # 이달의 PR = 그 lift의 이번 달 최고무게가 이전 모든 기록의 최고무게를 넘어선 종목 수
    personal_records = sum(
        1 for lid, w in month_best.items() if w > prior_best.get(lid, 0.0)
    )

    return {
        "year": year,
        "month": month,
        "sessions": len(month_logs),
        "total_sets": total_sets,
        "volume_lifted": round(volume, 1),
        "personal_records": personal_records,
    }
