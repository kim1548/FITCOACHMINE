"""
영양제 추천 — 휴리스틱 규칙 상수.

docs/12_영양제추천_휴리스틱규칙.md 의 가중치 테이블을 코드로 옮긴 것.
규칙이 데이터(상수)라 "왜 추천됐는지" 100% 설명 가능 — 블랙박스 아님.

엔진(supplement_engine)이 이 상수를 읽어 영양소별 부족 점수를 합산한다.
"""

# 영양소 코드 → 표시명 (nutrient_rda 테이블과 동일 코드)
NUTRIENT_NAMES = {
    "VIT_D": "비타민D",
    "OMEGA3": "오메가3",
    "CALCIUM": "칼슘",
    "MAGNESIUM": "마그네슘",
    "IRON": "철분",
    "ZINC": "아연",
    "VIT_C": "비타민C",
    "VIT_B": "비타민B군",
    "PROTEIN": "단백질",
    "PROBIOTICS": "유산균",
    "LUTEIN": "루테인",
    "FOLATE": "엽산",
    # 건강 고민 기반 추천용 기능성 원료
    "COLLAGEN": "콜라겐",
    "BIOTIN": "비오틴",
    "PANTOTHENIC": "판토텐산",
    "MSM": "MSM",
    "GLUCOSAMINE": "글루코사민",
    "MILK_THISTLE": "밀크씨슬",
    "COQ10": "코엔자임Q10",
}

# 레이더 차트에 표시할 핵심 영양소(12종). 기능성 원료는 고민 선택 시에만 점수가
# 붙으므로 레이더에선 빼고 추천 카드로만 노출 → 차트가 깔끔하게 유지된다.
CORE_NUTRIENTS = [
    "VIT_D", "OMEGA3", "CALCIUM", "MAGNESIUM", "IRON", "ZINC",
    "VIT_C", "VIT_B", "PROTEIN", "PROBIOTICS", "LUTEIN", "FOLATE",
]

# 영양소별 흡수·효과가 좋은 복용 시간대 (slot, 이유).
# 담을 때 제품의 주성분으로 시간대를 자동 추천하는 데 쓴다. slot ∈ 아침/점심/저녁/상관없음.
NUTRIENT_BEST_SLOT = {
    "VIT_D":       ("아침", "지용성 — 아침 식후에 흡수가 좋아요"),
    "OMEGA3":      ("저녁", "지용성 — 식사와 함께(저녁 식후) 흡수가 좋아요"),
    "CALCIUM":     ("저녁", "저녁·취침 전 분할 섭취가 흡수에 유리해요"),
    "MAGNESIUM":   ("저녁", "이완·수면에 도움 — 저녁/취침 전 권장"),
    "IRON":        ("아침", "아침 공복에 비타민C와 함께면 흡수가 좋아요"),
    "ZINC":        ("저녁", "철·칼슘과 시간차를 둬 저녁 식후 권장"),
    "VIT_C":       ("아침", "수용성 — 아침에 챙기기 좋아요"),
    "VIT_B":       ("아침", "에너지 대사 — 아침에 먹어야 수면 방해가 적어요"),
    "PROTEIN":     ("상관없음", "운동 전후·끼니 사이 아무 때나 좋아요"),
    "PROBIOTICS":  ("아침", "아침 공복에 위산 영향을 덜 받아요"),
    "LUTEIN":      ("아침", "지용성 — 아침 식후에 흡수가 좋아요"),
    "FOLATE":      ("아침", "아침에 다른 비타민과 함께 챙기기 좋아요"),
    "COLLAGEN":    ("아침", "아침 공복 또는 식후 아무 때나 좋아요"),
    "BIOTIN":      ("아침", "비타민B군 계열 — 아침 섭취 권장"),
    "PANTOTHENIC": ("아침", "비타민B군 계열 — 아침 섭취 권장"),
    "MSM":         ("아침", "관절 영양 — 아침·낮 식후 권장"),
    "GLUCOSAMINE": ("저녁", "식사와 함께(저녁 식후) 권장"),
    "MILK_THISTLE":("저녁", "간이 쉬는 저녁 식후 권장"),
    "COQ10":       ("아침", "활력 — 아침·낮 권장(밤엔 피하세요)"),
}

# 부족 채택 임계값: nutrient_score 가 이 값 이상이면 추천 대상으로 선정.
# 고민 기반(주원료 4 / 보조원료 2)에서 보조 원료까지 포함되도록 2로 둔다.
DEFICIENCY_THRESHOLD = 2

# 임계 미달일 때 폴백으로 채택할 상위 영양소 개수(빈 추천 방지)
FALLBACK_TOP_N = 3

# 목표별 단백질 권장 계수 (체중 1kg 당 g). docs/12 §3-8
PROTEIN_COEF = {
    "체중감소": 1.2,
    "벌크업": 1.6,
    "유지": 1.0,
}
PROTEIN_COEF_DEFAULT = 1.0

# 인구통계/생활습관 규칙.
# 각 규칙: signal(신호키) · match(판정 함수) · add(부여할 [(영양소, 가중치)]).
# 가중치 3=강 / 2=중 / 1=약.
DEMOGRAPHIC_RULES = [
    # 성별 (docs/12 §3-1)
    {"signal": "gender", "match": lambda v: v == "여", "add": [("IRON", 3), ("CALCIUM", 2)]},
    {"signal": "gender", "match": lambda v: v == "남", "add": [("ZINC", 2)]},

    # 나이 (§3-2)
    {"signal": "age", "match": lambda v: v is not None and v >= 40,
     "add": [("VIT_D", 2), ("CALCIUM", 2), ("LUTEIN", 2)]},
    {"signal": "age", "match": lambda v: v is not None and v <= 29, "add": [("VIT_B", 1)]},

    # 목표 (§3-3) — 저장값 표기 흔들림 대비해 부분일치
    {"signal": "goal", "match": lambda v: _has(v, "감소", "다이어트"),
     "add": [("VIT_B", 2), ("OMEGA3", 2), ("VIT_D", 1)]},
    {"signal": "goal", "match": lambda v: _has(v, "벌크", "증량", "근육"),
     "add": [("PROTEIN", 3), ("ZINC", 2), ("MAGNESIUM", 2)]},
    {"signal": "goal", "match": lambda v: _has(v, "유지"), "add": [("OMEGA3", 1)]},

    # 생활패턴 (§3-4)
    {"signal": "lifestyle", "match": lambda v: _has(v, "사무", "실내", "직장"),
     "add": [("VIT_D", 3), ("LUTEIN", 2), ("MAGNESIUM", 1)]},
    {"signal": "lifestyle", "match": lambda v: _has(v, "학생"),
     "add": [("VIT_B", 2), ("MAGNESIUM", 1)]},

    # 운동빈도 (§3-5) — 주4회 이상
    {"signal": "workout_freq_n", "match": lambda v: v is not None and v >= 4,
     "add": [("PROTEIN", 2), ("MAGNESIUM", 2), ("VIT_C", 1)]},

    # 흡연 (§3-6)
    {"signal": "is_smoker", "match": lambda v: v is True, "add": [("VIT_C", 3), ("OMEGA3", 1)]},

    # 임신·수유 (§3-7)
    {"signal": "is_pregnant", "match": lambda v: v is True,
     "add": [("FOLATE", 3), ("IRON", 3), ("CALCIUM", 2)]},
]


# 건강 고민 → 관련 영양소 가산 (필라이즈식 고민 기반 추천).
# 사용자가 고른 고민이 해당 영양소 점수를 강하게 밀어올려 그쪽 제품이 추천된다.
# 고민의 핵심 원료는 인구통계 가중치(최대 3)보다 크게(4) 둬서, 고민을 고르면
# 그 전용 제품이 추천 상위로 확실히 올라오게 한다.
CONCERN_RULES = {
    "피부":   [("COLLAGEN", 4), ("BIOTIN", 2), ("VIT_C", 2), ("ZINC", 1)],
    "모발":   [("BIOTIN", 4), ("ZINC", 2), ("PANTOTHENIC", 2), ("PROTEIN", 1)],
    "눈":     [("LUTEIN", 4), ("OMEGA3", 2)],
    "면역":   [("VIT_C", 3), ("VIT_D", 2), ("ZINC", 2)],
    "관절":   [("MSM", 4), ("GLUCOSAMINE", 4), ("CALCIUM", 1), ("OMEGA3", 1)],
    "수면":   [("MAGNESIUM", 4)],
    "피로":   [("VIT_B", 3), ("COQ10", 3), ("IRON", 1), ("MAGNESIUM", 1)],
    "장건강": [("PROBIOTICS", 4)],
    "간건강": [("MILK_THISTLE", 4)],
    "혈관":   [("OMEGA3", 3), ("COQ10", 3)],
}

# 프론트에 노출할 선택 가능한 고민 목록(순서 유지)
CONCERN_OPTIONS = list(CONCERN_RULES.keys())


def _has(value, *keywords) -> bool:
    """문자열 value 안에 keywords 중 하나라도 포함되면 True."""
    if not value:
        return False
    return any(k in value for k in keywords)
