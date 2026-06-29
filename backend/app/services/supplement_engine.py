"""
영양제 추천 엔진 (규칙 기반).

파이프라인 (docs/11 §3, docs/12):
  ① 신호 수집(gather_signals)  — 프로필 + 건강 프로필 + 식단(단백질 실섭취)
  ② 부족 점수(compute_nutrient_scores) — 휴리스틱 가중치 + 단백질 실데이터
  ③ 영양제 매칭(match_candidates) — 부족 영양소 → 성분 역인덱스
  ④ 안전 필터(safety_check) — 상호작용/금기 → 제외/경고
  ⑤ 점수화·랭킹(score_candidate) → Top N

ML 아님. compute_payload(db, user) 하나가 외부 진입점이고, persist() 로 결과를 캐시한다.
단백질만 실측(식단 기록 기반)이고 나머지는 인구통계 추정.
"""

import re
from datetime import date, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.diet_log import DietLog
from app.models.supplement import NutrientRDA, Supplement, SupplementIngredient, InteractionRule
from app.models.supplement_user import UserHealthProfile, SupplementRecommendation, UserSupplement
from app.services.supplement_rules import (
    NUTRIENT_NAMES, CORE_NUTRIENTS, CONCERN_RULES,
    DEFICIENCY_THRESHOLD, FALLBACK_TOP_N, PROTEIN_COEF, PROTEIN_COEF_DEFAULT,
)

DIET_WINDOW_DAYS = 7  # 단백질 평균 산정 기간


# ── ① 신호 수집 ──────────────────────────────────────────────
def _parse_freq(value: Optional[str]) -> Optional[int]:
    """'주3회' → 3. 숫자 없으면 None."""
    if not value:
        return None
    m = re.search(r"\d+", value)
    return int(m.group()) if m else None


def _avg_protein_intake(db: Session, user_id: int) -> Optional[float]:
    """최근 7일 식단의 일평균 단백질 실섭취(g). diet.py 와 동일하게 protein*weight/100 스케일.

    기록이 있는 날들로만 평균 → 가끔 기록한 유저도 과소평가되지 않게.
    """
    since = date.today() - timedelta(days=DIET_WINDOW_DAYS - 1)
    logs = (
        db.query(DietLog)
        .filter(DietLog.user_id == user_id, DietLog.date >= since)
        .all()
    )
    if not logs:
        return None
    total = sum((l.protein or 0) * ((l.weight or 100) / 100.0) for l in logs)
    days = len({l.date for l in logs}) or 1
    return round(total / days, 1)


def gather_signals(db: Session, user: User) -> dict:
    profile = (
        db.query(UserHealthProfile)
        .filter(UserHealthProfile.user_id == user.id)
        .first()
    )
    return {
        "gender": user.gender,
        "age": user.age,
        "goal": user.goal,
        "lifestyle": user.lifestyle,
        "weight": user.weight,
        "workout_freq_n": _parse_freq(user.workout_frequency),
        "is_smoker": bool(profile.is_smoker) if profile else False,
        "is_pregnant": bool(profile.is_pregnant) if profile else False,
        "allergies": (profile.allergies or []) if profile else [],
        "conditions": (profile.conditions or []) if profile else [],
        "medications": (profile.medications or []) if profile else [],
        "concerns": (profile.concerns or []) if profile else [],
        "protein_intake": _avg_protein_intake(db, user.id),
    }


# ── ② 부족 점수 ──────────────────────────────────────────────
def _protein_target(signals: dict) -> Optional[float]:
    weight = signals.get("weight")
    if not weight:
        return None
    coef = PROTEIN_COEF_DEFAULT
    goal = signals.get("goal") or ""
    for key, c in PROTEIN_COEF.items():
        if key in goal:
            coef = c
            break
    return round(weight * coef, 1)


def compute_nutrient_scores(signals: dict) -> dict:
    """영양소 코드 → 부족 점수. 건강 고민(concerns)만으로 산정한다.

    프로필 인구통계 조건은 추천에 쓰지 않는다(사용자 요청). 고민을 고르지
    않으면 전부 0 → 추천 없음. 안전 필터(알러지/질환/약/임신)는 별도로 적용된다.
    """
    scores = {code: 0 for code in NUTRIENT_NAMES}
    for concern in (signals.get("concerns") or []):
        for code, weight in CONCERN_RULES.get(concern, []):
            scores[code] += weight
    return scores


def select_deficient(scores: dict) -> list:
    """임계값 이상 영양소 코드(점수 내림차순). 없으면 상위 N개 폴백."""
    chosen = [c for c, s in scores.items() if s >= DEFICIENCY_THRESHOLD]
    if not chosen:
        chosen = [c for c, s in sorted(scores.items(), key=lambda x: -x[1]) if s > 0][:FALLBACK_TOP_N]
    return sorted(chosen, key=lambda c: -scores[c])


# ── RDA 조회 (커버리지 분모) ─────────────────────────────────
def _lookup_rda(db: Session, code: str, sex: Optional[str], age: Optional[int]) -> Optional[float]:
    q = db.query(NutrientRDA).filter(NutrientRDA.nutrient_code == code)
    rows = q.all()
    if not rows:
        return None
    # 성별 매칭(공통 포함) → 연령 구간 매칭 → 첫 행 폴백
    def ok(r):
        sex_ok = r.sex == "공통" or (sex and r.sex == sex)
        age_ok = age is None or (r.age_min <= age <= r.age_max)
        return sex_ok and age_ok
    matched = [r for r in rows if ok(r)]
    target = matched[0] if matched else rows[0]
    return target.rda


# ── 내 영양제 충족률 (보유 영양제 기준) ─────────────────────
def compute_my_coverage(db: Session, user: User) -> list:
    """내가 보유한 영양제 성분이 권장량(RDA)을 얼마나 채우는지.
    - 추천이 아니라 '내 영양제' 기준 → 추천/고민이 바뀌어도 안 흔들림.
    - 선택한 고민은 관련 영양소의 목표량을 상향(먹어야 할 양↑)하고, 새 영양소를 추가한다.
    표시 대상 = 보유 성분 ∪ 고민 관련 영양소.
    """
    sex, age = user.gender, user.age
    prof = db.query(UserHealthProfile).filter(UserHealthProfile.user_id == user.id).first()
    concerns = (prof.concerns or []) if prof else []

    # 고민 가중치(영양소별 합) → 목표량 상향에 사용
    cw = {}
    for c in concerns:
        for code, w in CONCERN_RULES.get(c, []):
            cw[code] = cw.get(code, 0) + w

    # 보유 영양제 성분 합산
    owned_ids = [r.supplement_id for r in
                 db.query(UserSupplement).filter(UserSupplement.user_id == user.id).all()]
    owned = {}
    if owned_ids:
        for ing in db.query(SupplementIngredient).filter(
                SupplementIngredient.supplement_id.in_(owned_ids)).all():
            owned[ing.nutrient_code] = owned.get(ing.nutrient_code, 0.0) + (ing.amount or 0)

    codes = set(owned.keys()) | set(cw.keys())
    bars = []
    for code in codes:
        rda = _lookup_rda(db, code, sex, age)
        if not rda or rda <= 0:
            continue
        target = rda * (1 + 0.15 * cw.get(code, 0))      # 고민이 목표량 상향(완만)
        target = min(target, rda * 2.0)                  # 과도한 상향 방지
        have = owned.get(code, 0.0)
        coverage = max(0, min(100, round(have / target * 100)))
        bars.append({
            "code": code,
            "name": NUTRIENT_NAMES.get(code, code),
            "coverage": coverage,
            "have": round(have, 1),
            "target": round(target, 1),
            "boosted": cw.get(code, 0) > 0,   # 고민으로 목표 상향된 항목
        })
    bars.sort(key=lambda b: (b["coverage"], b["name"]))  # 충족 낮은 순(부족분 먼저)
    return bars


# ── ③ 매칭 + ⑤ 점수화 ───────────────────────────────────────
def match_candidates(db: Session, deficient: list) -> dict:
    """부족 영양소를 가진 영양제 → {supplement_id: [SupplementIngredient,...]}."""
    if not deficient:
        return {}
    ings = (
        db.query(SupplementIngredient)
        .filter(SupplementIngredient.nutrient_code.in_(deficient))
        .all()
    )
    by_supp = {}
    for ing in ings:
        by_supp.setdefault(ing.supplement_id, []).append(ing)
    return by_supp


# ── ④ 안전 필터 ──────────────────────────────────────────────
def safety_check(db: Session, codes: list, signals: dict) -> tuple:
    """제품 성분 코드들에 대해 상호작용 규칙 적용 → (excluded, warnings)."""
    rules = (
        db.query(InteractionRule)
        .filter(InteractionRule.nutrient_code.in_(codes))
        .all()
    )
    excluded = False
    warnings = []
    for r in rules:
        hit = False
        if r.condition_type == "약물":
            hit = r.condition_value in (signals.get("medications") or [])
        elif r.condition_type == "질환":
            hit = r.condition_value in (signals.get("conditions") or [])
        elif r.condition_type == "알러지":
            hit = r.condition_value in (signals.get("allergies") or [])
        elif r.condition_type == "임신":
            hit = bool(signals.get("is_pregnant"))
        if not hit:
            continue
        if r.severity == "금기":
            excluded = True
        warnings.append(r.message)
    return excluded, warnings


def score_candidate(db: Session, ings: list, scores: dict, deficient: list,
                    signals: dict, total_deficiency: int) -> dict:
    """제품 1개 점수화. score_raw = Σ(부족점수 × 함량커버리지), 0~100 정규화."""
    covered = []
    score_raw = 0.0
    for ing in ings:
        code = ing.nutrient_code
        if code not in deficient:
            continue
        # 커버리지 분모: 단백질은 개인 목표, 그 외는 RDA
        if code == "PROTEIN":
            denom = _protein_target(signals)
        else:
            denom = _lookup_rda(db, code, signals.get("gender"), signals.get("age"))
        if denom and denom > 0:
            coverage = min(ing.amount / denom, 1.0)
        else:
            coverage = 1.0
        contrib = scores[code] * coverage
        score_raw += contrib
        covered.append({
            "code": code,
            "name": NUTRIENT_NAMES.get(code, code),
            "nutrient_score": scores[code],
            "amount": ing.amount,
            "unit": ing.unit,
            "coverage": round(coverage, 2),
        })
    normalized = round(min(100.0, score_raw / total_deficiency * 100), 1) if total_deficiency else 0.0
    return {"score": normalized, "score_raw": round(score_raw, 2), "covered": covered}


# ── 외부 진입점 ──────────────────────────────────────────────
def compute_payload(db: Session, user: User, top_n: int = 5) -> dict:
    """추천 산출(DB 쓰기 없음). 라우터가 persist() 로 저장."""
    signals = gather_signals(db, user)
    scores = compute_nutrient_scores(signals)
    deficient = select_deficient(scores)
    total_deficiency = sum(scores[c] for c in deficient) or 1

    candidates = match_candidates(db, deficient)
    supp_map = {s.id: s for s in db.query(Supplement).filter(Supplement.id.in_(candidates.keys())).all()} \
        if candidates else {}

    results = []
    for supp_id, ings in candidates.items():
        supp = supp_map.get(supp_id)
        if supp is None:
            continue
        all_codes = [i.nutrient_code for i in ings]
        excluded, warnings = safety_check(db, all_codes, signals)
        if excluded:
            continue  # 금기 → 추천 제외
        scored = score_candidate(db, ings, scores, deficient, signals, total_deficiency)
        if scored["score"] <= 0:
            continue
        results.append({
            "supplement_id": supp.id,
            "name": supp.name,
            "brand": supp.brand,
            "category": supp.category,
            "form": supp.form,
            "timing": supp.timing,
            "image_url": supp.image_url,
            "price": supp.price,
            "buy_url": supp.buy_url,
            "rating": supp.rating,
            "score": scored["score"],
            "warnings": warnings,
            "reason": {
                "covered": scored["covered"],
                "warnings": warnings,
                "score_raw": scored["score_raw"],
            },
        })

    results.sort(key=lambda r: -r["score"])
    results = results[:top_n]

    radar = [
        {"code": c, "name": NUTRIENT_NAMES[c], "score": scores[c], "deficient": c in deficient}
        for c in CORE_NUTRIENTS
    ]
    return {
        "recommendations": results,
        "radar": radar,
        "deficient": [{"code": c, "name": NUTRIENT_NAMES[c], "score": scores[c]} for c in deficient],
        "protein_intake": signals.get("protein_intake"),
        "protein_target": _protein_target(signals),
    }


def persist(db: Session, user: User, recommendations: list) -> list:
    """기존 추천 캐시 삭제 후 새로 저장. 생성된 reco id 리스트 반환(AI 코멘트 스케줄용)."""
    db.query(SupplementRecommendation).filter(
        SupplementRecommendation.user_id == user.id
    ).delete()
    ids = []
    for r in recommendations:
        reco = SupplementRecommendation(
            user_id=user.id,
            supplement_id=r["supplement_id"],
            score=r["score"],
            reason_json=r["reason"],
        )
        db.add(reco)
        db.flush()
        ids.append(reco.id)
        r["recommendation_id"] = reco.id
    db.commit()
    return ids
