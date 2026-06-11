"""
영양제 추천 — 카탈로그 / 참조 테이블 모델.

전부 시드(seed) 데이터로 채워지는 정적 테이블이다.
시드 CSV: app/data/supplements/{nutrient_rda,supplement,supplement_ingredient,interaction_rule}.csv
설계: docs/11_영양제추천엔진_설계서.md §2-1

영양소 코드(nutrient_code)는 NutrientRDA·SupplementIngredient·InteractionRule 가 공유하는 매칭 키다.
(VIT_D, OMEGA3, CALCIUM, MAGNESIUM, IRON, ZINC, VIT_C, VIT_B, PROTEIN, PROBIOTICS, LUTEIN, FOLATE)
"""

from sqlalchemy import Column, Integer, Float, String, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.database import Base


class NutrientRDA(Base):
    """영양소별 권장섭취량(RDA)·상한섭취량(UL). 출처: KDRIs 한국인 영양소 섭취기준.

    부족/과다 판정은 사용자의 (성별, 나이)에 맞는 행을 골라 비교한다.
    sex 는 '남'/'여'/'공통', 나이는 [age_min, age_max] 구간으로 매칭.
    """
    __tablename__ = "nutrient_rda"

    id = Column(Integer, primary_key=True, index=True)
    nutrient_code = Column(String, index=True)   # 매칭 키 (예: VIT_D)
    nutrient_name = Column(String)               # 표시명 (비타민D)
    sex = Column(String)                         # 남 / 여 / 공통
    age_min = Column(Integer)                    # 적용 연령 하한 (포함)
    age_max = Column(Integer)                    # 적용 연령 상한 (포함)
    rda = Column(Float)                          # 권장섭취량(일)
    upper_limit = Column(Float, nullable=True)   # 상한섭취량 (없으면 NULL)
    unit = Column(String)                        # mg, µg, IU, g, 억CFU 등


class Supplement(Base):
    """영양제 제품 마스터. 데이터 소스는 수동 시드 또는 식약처 OpenAPI(추후 교체 가능)."""
    __tablename__ = "supplements"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)            # 제품명 (브랜드 일반화)
    brand = Column(String, nullable=True)
    category = Column(String)                    # 비타민/미네랄/오메가/유산균/단백질/복합
    form = Column(String)                        # 정제/캡슐/분말 등
    timing = Column(String)                      # 권장 복용 시점 (아침공복/식후/취침전/운동후 등)
    serving_desc = Column(String, nullable=True) # 1회 섭취 안내
    image_url = Column(String, nullable=True)
    price = Column(Float, nullable=True)         # 대략 판매가 (원)
    buy_url = Column(String, nullable=True)      # 직접 구매 링크(없으면 프론트가 검색 링크로 폴백)
    rating = Column(Float, nullable=True)        # 평점 (5점 만점)

    ingredients = relationship(
        "SupplementIngredient", backref="supplement", cascade="all, delete-orphan"
    )


class SupplementIngredient(Base):
    """영양제 ↔ 성분 함량 (N:N). nutrient_code 로 NutrientRDA 와 연결된다."""
    __tablename__ = "supplement_ingredients"

    id = Column(Integer, primary_key=True, index=True)
    supplement_id = Column(Integer, ForeignKey("supplements.id", ondelete="CASCADE"), index=True)
    nutrient_code = Column(String, index=True)   # NutrientRDA.nutrient_code 와 매칭
    amount = Column(Float)                        # 1회 함량
    unit = Column(String)


class InteractionRule(Base):
    """상호작용/금기 규칙. 안전 필터(설계서 §3④)에서 사용자 프로필과 대조한다.

    condition_type: 약물 / 질환 / 알러지 / 임신
    severity: 금기(추천 제외) / 주의(경고만)
    """
    __tablename__ = "interaction_rules"

    id = Column(Integer, primary_key=True, index=True)
    nutrient_code = Column(String, index=True)
    condition_type = Column(String)              # 약물 / 질환 / 알러지 / 임신
    condition_value = Column(String)             # 예: 와파린, 신장질환, 갑각류
    severity = Column(String)                    # 금기 / 주의
    message = Column(Text)                        # 사용자 표시 문구


# nutrient_code 로 영양제 후보를 역인덱스 조회(설계서 §3③)하므로 복합 인덱스 부여
Index("ix_supp_ingredient_code", SupplementIngredient.nutrient_code, SupplementIngredient.supplement_id)
