"""
영양제 추천 엔드포인트.

- 건강 프로필 CRUD (추천 입력)
- 추천 실행/조회 (휴리스틱 엔진 + Gemma 추천 이유)
- 영양제 상세 (성분 + 현 사용자 경고)

복용 기록/알림(intake, reminders)은 다음 단계(Phase 2/3)에서 추가.
인증·DB 의존성·BackgroundTasks 패턴은 body.py 와 동일.
"""

from typing import List, Optional
from datetime import date as date_t
from collections import Counter

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.supplement import Supplement, SupplementIngredient, InteractionRule
from app.models.supplement_user import (
    UserHealthProfile, SupplementRecommendation, UserSupplement, SupplementIntakeLog,
)
from app.api.v1.endpoints.auth import get_current_user
from app.services import supplement_engine as engine
from app.services.supplement_ai import generate_and_save_reco_comment
from app.services.supplement_rules import (
    NUTRIENT_NAMES, CORE_NUTRIENTS, CONCERN_OPTIONS, NUTRIENT_BEST_SLOT,
)

router = APIRouter()

# 복용 시간대
SLOT_OPTIONS = ["아침", "점심", "저녁", "상관없음"]
_SLOT_ORDER = {"아침": 0, "저녁": 1, "점심": 2, "상관없음": 3}


def _auto_slot(timing: Optional[str]) -> str:
    """성분 정보가 없을 때의 폴백 — 제품 권장 복용시점(timing) 기반."""
    if timing in ("아침공복", "아침식후"):
        return "아침"
    if timing == "취침전":
        return "저녁"
    return "상관없음"


def _slot_from_ingredients(ings, fallback_timing=None):
    """영양제의 성분들로 최적 복용 시간대(slot)와 이유를 추천한다.

    각 성분의 권장 시간대를 투표해 다수결로 정하고(동률이면 아침>저녁>점심>상관없음),
    그 시간대를 권장하는 성분의 이유 한 줄을 함께 돌려준다.
    """
    if not ings:
        return _auto_slot(fallback_timing), None
    votes = Counter()
    reason_by_slot = {}
    for i in ings:
        slot, reason = NUTRIENT_BEST_SLOT.get(i.nutrient_code, ("상관없음", None))
        votes[slot] += 1
        reason_by_slot.setdefault(slot, reason)
    best = sorted(votes.items(), key=lambda kv: (-kv[1], _SLOT_ORDER.get(kv[0], 9)))[0][0]
    return best, reason_by_slot.get(best)


# ── 스키마 ───────────────────────────────────────────────────
class HealthProfileIn(BaseModel):
    is_smoker: bool = False
    is_pregnant: bool = False
    allergies: List[str] = []
    conditions: List[str] = []
    medications: List[str] = []
    concerns: List[str] = []


def _serialize_profile(p: Optional[UserHealthProfile]) -> dict:
    if p is None:
        return {"is_smoker": False, "is_pregnant": False, "allergies": [],
                "conditions": [], "medications": [], "concerns": []}
    return {
        "is_smoker": bool(p.is_smoker),
        "is_pregnant": bool(p.is_pregnant),
        "allergies": p.allergies or [],
        "conditions": p.conditions or [],
        "medications": p.medications or [],
        "concerns": p.concerns or [],
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


# ── 건강 프로필 ──────────────────────────────────────────────
@router.get("/concerns")
def list_concerns():
    """선택 가능한 건강 고민 목록(프론트 칩 렌더용)."""
    return {"concerns": CONCERN_OPTIONS}


@router.get("/profile")
def get_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = db.query(UserHealthProfile).filter(
        UserHealthProfile.user_id == current_user.id
    ).first()
    return _serialize_profile(p)


@router.put("/profile")
def upsert_profile(
    data: HealthProfileIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = db.query(UserHealthProfile).filter(
        UserHealthProfile.user_id == current_user.id
    ).first()
    if p is None:
        p = UserHealthProfile(user_id=current_user.id)
        db.add(p)
    p.is_smoker = data.is_smoker
    p.is_pregnant = data.is_pregnant
    p.allergies = data.allergies
    p.conditions = data.conditions
    p.medications = data.medications
    p.concerns = data.concerns
    db.commit()
    db.refresh(p)
    return _serialize_profile(p)


# ── 추천 ─────────────────────────────────────────────────────
@router.post("/recommend")
def recommend(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """휴리스틱 엔진으로 추천 산출 → 캐시 저장. 추천 이유(AI)는 비동기로 채운다."""
    payload = engine.compute_payload(db, current_user, top_n=12)
    engine.persist(db, current_user, payload["recommendations"])
    # 각 추천에 Gemma 코멘트를 비동기 요청 (Ollama 없어도 본 응답은 정상)
    for r in payload["recommendations"]:
        background_tasks.add_task(generate_and_save_reco_comment, r["recommendation_id"])
    return payload


@router.get("/recommendations")
def list_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """현재 고민(concerns) 기준 추천 목록 + 레이더. 고민이 없으면 빈 목록."""
    # 현재 고민으로 부족 영양소를 먼저 계산 → 옛 캐시(다른 기준으로 만든)는 걸러진다.
    signals = engine.gather_signals(db, current_user)
    scores = engine.compute_nutrient_scores(signals)
    deficient = set(engine.select_deficient(scores))
    radar = [
        {"code": c, "name": NUTRIENT_NAMES[c], "score": scores[c], "deficient": c in deficient}
        for c in CORE_NUTRIENTS
    ]
    my_coverage = engine.compute_my_coverage(db, current_user)
    if not deficient:
        return {"recommendations": [], "radar": radar, "my_coverage": my_coverage}

    recos = (
        db.query(SupplementRecommendation)
        .filter(SupplementRecommendation.user_id == current_user.id)
        .order_by(SupplementRecommendation.score.desc())
        .all()
    )
    supp_ids = [r.supplement_id for r in recos]
    supp_map = {s.id: s for s in db.query(Supplement).filter(Supplement.id.in_(supp_ids)).all()} \
        if supp_ids else {}

    items = []
    for r in recos:
        s = supp_map.get(r.supplement_id)
        if s is None:
            continue
        reason = r.reason_json or {}
        covered = reason.get("covered", [])
        # 현재 부족 영양소를 하나도 커버 못 하는 옛 추천은 제외
        if not any(c.get("code") in deficient for c in covered):
            continue
        items.append({
            "recommendation_id": r.id,
            "supplement_id": r.supplement_id,
            "name": s.name,
            "brand": s.brand,
            "category": s.category,
            "form": s.form,
            "timing": s.timing,
            "image_url": s.image_url,
            "price": s.price,
            "buy_url": s.buy_url,
            "rating": s.rating,
            "score": r.score,
            "warnings": reason.get("warnings", []),
            "covered": reason.get("covered", []),
            "ai_comment": r.ai_comment,
            "ai_generated_at": r.ai_generated_at.isoformat() if r.ai_generated_at else None,
        })

    return {"recommendations": items, "radar": radar, "my_coverage": my_coverage}


@router.post("/recommendations/{reco_id}/regenerate")
def regenerate_comment(
    reco_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """AI 코멘트 생성 실패 시 사용자가 직접 누르는 폴백 — 동기 호출."""
    reco = db.query(SupplementRecommendation).filter(
        SupplementRecommendation.id == reco_id,
        SupplementRecommendation.user_id == current_user.id,
    ).first()
    if reco is None:
        raise HTTPException(status_code=404, detail="해당 추천을 찾을 수 없습니다.")
    comment = generate_and_save_reco_comment(reco.id)
    if comment is None:
        raise HTTPException(
            status_code=503,
            detail="AI 코멘트 생성에 실패했습니다. (Ollama 서버가 응답하지 않습니다.)",
        )
    return {"ai_comment": comment}


# ── 내 영양제 (담기 + 시간대 조합 + 매일 체크) ────────────────
class MySupplementIn(BaseModel):
    supplement_id: int
    slot: Optional[str] = None       # 없으면 timing 으로 자동 배정


class SlotIn(BaseModel):
    slot: str


class IntakeToggleIn(BaseModel):
    supplement_id: int
    date: Optional[str] = None        # YYYY-MM-DD, 없으면 오늘


def _today_taken_ids(db: Session, user_id: int, day: date_t) -> set:
    rows = (
        db.query(SupplementIntakeLog.supplement_id)
        .filter(
            SupplementIntakeLog.user_id == user_id,
            SupplementIntakeLog.taken_date == day,
            SupplementIntakeLog.status == "taken",
        )
        .all()
    )
    return {r[0] for r in rows}


@router.get("/my")
def my_supplements(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """담은 영양제 목록(시간대 슬롯 + 오늘 체크 여부 포함)."""
    today = date_t.today()
    taken = _today_taken_ids(db, current_user.id, today)
    rows = (
        db.query(UserSupplement)
        .filter(UserSupplement.user_id == current_user.id)
        .order_by(UserSupplement.created_at.asc())
        .all()
    )
    supp_ids = [r.supplement_id for r in rows]
    smap = {s.id: s for s in db.query(Supplement).filter(Supplement.id.in_(supp_ids)).all()} \
        if supp_ids else {}
    # 성분을 한 번에 모아 시간대 추천 계산
    ing_by_supp = {}
    if supp_ids:
        for ing in db.query(SupplementIngredient).filter(
            SupplementIngredient.supplement_id.in_(supp_ids)
        ).all():
            ing_by_supp.setdefault(ing.supplement_id, []).append(ing)

    items = []
    for r in rows:
        s = smap.get(r.supplement_id)
        if s is None:
            continue
        rec_slot, reason = _slot_from_ingredients(ing_by_supp.get(r.supplement_id, []), s.timing)
        items.append({
            "supplement_id": r.supplement_id,
            "name": s.name,
            "brand": s.brand,
            "category": s.category,
            "timing": s.timing,
            "image_url": s.image_url,
            "slot": r.slot,
            "recommended_slot": rec_slot,
            "slot_reason": reason,
            "checked_today": r.supplement_id in taken,
        })
    return {"slots": SLOT_OPTIONS, "today": today.isoformat(), "items": items}


@router.post("/my")
def add_my_supplement(
    data: MySupplementIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    supp = db.query(Supplement).filter(Supplement.id == data.supplement_id).first()
    if supp is None:
        raise HTTPException(status_code=404, detail="해당 영양제를 찾을 수 없습니다.")
    existing = db.query(UserSupplement).filter(
        UserSupplement.user_id == current_user.id,
        UserSupplement.supplement_id == data.supplement_id,
    ).first()
    if existing is None:
        if data.slot in SLOT_OPTIONS:
            slot = data.slot
        else:
            ings = db.query(SupplementIngredient).filter(
                SupplementIngredient.supplement_id == supp.id
            ).all()
            slot, _ = _slot_from_ingredients(ings, supp.timing)
        existing = UserSupplement(
            user_id=current_user.id, supplement_id=data.supplement_id, slot=slot,
        )
        db.add(existing)
        db.commit()
    return {"status": "added", "supplement_id": data.supplement_id, "slot": existing.slot}


@router.put("/my/{supplement_id}/slot")
def update_my_slot(
    supplement_id: int,
    data: SlotIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.slot not in SLOT_OPTIONS:
        raise HTTPException(status_code=400, detail="유효하지 않은 시간대입니다.")
    row = db.query(UserSupplement).filter(
        UserSupplement.user_id == current_user.id,
        UserSupplement.supplement_id == supplement_id,
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="담은 영양제가 아닙니다.")
    row.slot = data.slot
    db.commit()
    return {"status": "updated", "supplement_id": supplement_id, "slot": row.slot}


@router.delete("/my/{supplement_id}")
def remove_my_supplement(
    supplement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(UserSupplement).filter(
        UserSupplement.user_id == current_user.id,
        UserSupplement.supplement_id == supplement_id,
    ).first()
    if row is not None:
        db.delete(row)
        db.commit()
    return {"status": "removed", "supplement_id": supplement_id}


@router.post("/intake/toggle")
def toggle_intake(
    data: IntakeToggleIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """오늘(또는 지정일) 해당 영양제 복용 체크 토글. 체크되어 있으면 해제."""
    try:
        day = date_t.fromisoformat(data.date) if data.date else date_t.today()
    except ValueError:
        raise HTTPException(status_code=400, detail="date는 YYYY-MM-DD 형식이어야 합니다.")
    existing = db.query(SupplementIntakeLog).filter(
        SupplementIntakeLog.user_id == current_user.id,
        SupplementIntakeLog.supplement_id == data.supplement_id,
        SupplementIntakeLog.taken_date == day,
    ).first()
    if existing is not None:
        db.delete(existing)
        db.commit()
        return {"supplement_id": data.supplement_id, "checked": False}
    db.add(SupplementIntakeLog(
        user_id=current_user.id, supplement_id=data.supplement_id,
        taken_date=day, status="taken",
    ))
    db.commit()
    return {"supplement_id": data.supplement_id, "checked": True}


# ── 영양제 상세 ──────────────────────────────────────────────
@router.get("/{supplement_id}")
def supplement_detail(
    supplement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    supp = db.query(Supplement).filter(Supplement.id == supplement_id).first()
    if supp is None:
        raise HTTPException(status_code=404, detail="해당 영양제를 찾을 수 없습니다.")
    ings = db.query(SupplementIngredient).filter(
        SupplementIngredient.supplement_id == supplement_id
    ).all()
    codes = [i.nutrient_code for i in ings]

    # 현 사용자 기준 경고 산출
    signals = engine.gather_signals(db, current_user)
    excluded, warnings = engine.safety_check(db, codes, signals)

    return {
        "id": supp.id,
        "name": supp.name,
        "brand": supp.brand,
        "category": supp.category,
        "form": supp.form,
        "timing": supp.timing,
        "serving_desc": supp.serving_desc,
        "image_url": supp.image_url,
        "price": supp.price,
        "buy_url": supp.buy_url,
        "rating": supp.rating,
        "ingredients": [
            {"code": i.nutrient_code, "name": NUTRIENT_NAMES.get(i.nutrient_code, i.nutrient_code),
             "amount": i.amount, "unit": i.unit}
            for i in ings
        ],
        "contraindicated": excluded,
        "warnings": warnings,
    }
