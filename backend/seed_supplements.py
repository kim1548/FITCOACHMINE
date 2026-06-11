"""
영양제 추천 시드 적재 스크립트.

app/data/supplements/*.csv 의 정적 데이터를 DB(test.db)에 적재한다.
참조 4종(nutrient_rda, supplements, supplement_ingredients, interaction_rules)을
매번 비우고 다시 채우는 멱등(idempotent) 방식 — 재실행해도 안전하다.
사용자/동적 테이블(프로필·추천·복용·알림)은 건드리지 않는다.

실행 (backend/ 디렉터리에서):
    python seed_supplements.py
"""

import csv
import os

from sqlalchemy import inspect, text

from app.database import Base, engine, SessionLocal
# 모델 임포트(테이블 등록). User 도 import 해야 supplement_user 의 FK(users.id)가 해석된다.
from app.models.user import User  # noqa: F401  (FK 대상 테이블 등록용)
from app.models.supplement import (
    NutrientRDA, Supplement, SupplementIngredient, InteractionRule,
)
from app.models import supplement_user  # noqa: F401  (테이블 자동 생성용)

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app", "data", "supplements")


def _read(filename):
    path = os.path.join(DATA_DIR, filename)
    with open(path, encoding="utf-8") as fp:
        return list(csv.DictReader(fp))


def _num(value, cast=float):
    """빈 문자열/None 은 None, 그 외엔 cast 적용."""
    if value is None:
        return None
    value = value.strip()
    if value == "":
        return None
    return cast(value)


def _str(value):
    if value is None:
        return None
    value = value.strip()
    return value or None


def _ensure_supplement_columns():
    """create_all 은 기존 테이블에 새 컬럼을 추가하지 않으므로, supplements 에
    price / buy_url / rating 이 없으면 한 번만 ALTER TABLE 로 채워준다."""
    inspector = inspect(engine)
    if "supplements" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("supplements")}
    adds = {"price": "FLOAT", "buy_url": "VARCHAR", "rating": "FLOAT"}
    with engine.connect() as conn:
        for name, ddl in adds.items():
            if name not in cols:
                conn.execute(text(f"ALTER TABLE supplements ADD COLUMN {name} {ddl}"))
        conn.commit()

    # user_health_profiles.concerns (건강 고민 기반 추천)
    if "user_health_profiles" in inspector.get_table_names():
        pcols = {c["name"] for c in inspector.get_columns("user_health_profiles")}
        if "concerns" not in pcols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE user_health_profiles ADD COLUMN concerns JSON"))
                conn.commit()


def seed(db):
    # 1) 기존 참조 데이터 비우기 (자식 → 부모 순서로 삭제)
    db.query(SupplementIngredient).delete()
    db.query(InteractionRule).delete()
    db.query(NutrientRDA).delete()
    db.query(Supplement).delete()
    db.commit()

    # 2) nutrient_rda
    rda_rows = _read("nutrient_rda.csv")
    for r in rda_rows:
        db.add(NutrientRDA(
            nutrient_code=r["nutrient_code"].strip(),
            nutrient_name=r["nutrient_name"].strip(),
            sex=r["sex"].strip(),
            age_min=int(r["age_min"]),
            age_max=int(r["age_max"]),
            rda=_num(r["rda"]),
            upper_limit=_num(r["upper_limit"]),
            unit=r["unit"].strip(),
        ))

    # 3) supplements (CSV id 를 PK 로 그대로 사용 → ingredient FK 정합)
    sup_rows = _read("supplement.csv")
    for r in sup_rows:
        db.add(Supplement(
            id=int(r["id"]),
            name=r["name"].strip(),
            brand=_str(r.get("brand")),
            category=r["category"].strip(),
            form=r["form"].strip(),
            timing=r["timing"].strip(),
            serving_desc=_str(r.get("serving_desc")),
            image_url=_str(r.get("image_url")),
            price=_num(r.get("price")),
            buy_url=_str(r.get("buy_url")),
            rating=_num(r.get("rating")),
        ))
    db.flush()  # supplements 를 먼저 반영해 FK 참조 가능하게

    # 4) supplement_ingredients
    ing_rows = _read("supplement_ingredient.csv")
    for r in ing_rows:
        db.add(SupplementIngredient(
            id=int(r["id"]),
            supplement_id=int(r["supplement_id"]),
            nutrient_code=r["nutrient_code"].strip(),
            amount=_num(r["amount"]),
            unit=r["unit"].strip(),
        ))

    # 5) interaction_rules
    ir_rows = _read("interaction_rule.csv")
    for r in ir_rows:
        db.add(InteractionRule(
            id=int(r["id"]),
            nutrient_code=r["nutrient_code"].strip(),
            condition_type=r["condition_type"].strip(),
            condition_value=r["condition_value"].strip(),
            severity=r["severity"].strip(),
            message=r["message"].strip(),
        ))

    db.commit()
    return {
        "nutrient_rda": len(rda_rows),
        "supplements": len(sup_rows),
        "supplement_ingredients": len(ing_rows),
        "interaction_rules": len(ir_rows),
    }


def main():
    Base.metadata.create_all(bind=engine)  # 새 테이블 생성(이미 있으면 무시)
    _ensure_supplement_columns()           # 기존 테이블엔 새 컬럼 ALTER 로 보강
    db = SessionLocal()
    try:
        counts = seed(db)
        print("[OK] 영양제 시드 적재 완료")
        for table, n in counts.items():
            print(f"   - {table}: {n} rows")
    finally:
        db.close()


if __name__ == "__main__":
    main()
