"""
영양제 추천 — 사용자/동적 테이블 모델.

추천 입력 프로필, 추천 결과 캐시, 복용 기록, 알림 스케줄.
설계: docs/11_영양제추천엔진_설계서.md §2-2

추천 결과는 InBodyLog.ai_comment 와 동일하게 캐시 패턴(ai_comment + ai_generated_at)을 따른다.
"""

from sqlalchemy import (
    Column, Integer, Float, String, Text, Boolean, Date, DateTime,
    ForeignKey, JSON, UniqueConstraint,
)
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class UserHealthProfile(Base):
    """추천 입력용 건강 프로필 (users 1:1 확장). 추천 기능 전용이라 별도 테이블로 분리.

    allergies / conditions / medications 는 문자열 리스트(JSON)로 저장한다.
    예: medications = ["와파린"], conditions = ["고혈압"]
    """
    __tablename__ = "user_health_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, index=True)

    is_smoker = Column(Boolean, default=False)       # 흡연
    is_pregnant = Column(Boolean, default=False)     # 임신/수유
    allergies = Column(JSON, default=list)           # 알러지 목록
    conditions = Column(JSON, default=list)          # 기저질환
    medications = Column(JSON, default=list)         # 복용 약
    concerns = Column(JSON, default=list)            # 건강 고민(피부/모발/관절 등) — 고민 기반 추천

    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    user = relationship("User", backref="health_profile")


class SupplementRecommendation(Base):
    """추천 결과 캐시. /recommend 실행 시 산출 → 저장, AI 코멘트는 BackgroundTasks 로 채운다."""
    __tablename__ = "supplement_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    supplement_id = Column(Integer, ForeignKey("supplements.id"), index=True)

    score = Column(Float)                            # 0~100
    reason_json = Column(JSON, nullable=True)        # 근거(부족 영양소·커버리지·경고) — 표시/디버그용
    ai_comment = Column(Text, nullable=True)         # Gemma 추천 이유
    ai_generated_at = Column(DateTime, nullable=True)
    generated_at = Column(DateTime, default=datetime.now)

    supplement = relationship("Supplement")


class UserSupplement(Base):
    """사용자가 '담은' 영양제 + 복용 시간대(아침/점심/저녁/상관없음).

    추천 카드에서 담으면 timing 으로 슬롯을 자동 배정하고, 사용자가 바꿀 수 있다.
    매일 체크(복용 기록)는 SupplementIntakeLog 로 분리해 날짜별로 쌓는다.
    """
    __tablename__ = "user_supplements"
    __table_args__ = (
        UniqueConstraint("user_id", "supplement_id", name="uq_user_supplement"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    supplement_id = Column(Integer, ForeignKey("supplements.id"), index=True)

    slot = Column(String, default="상관없음")   # 아침 / 점심 / 저녁 / 상관없음
    created_at = Column(DateTime, default=datetime.now)

    supplement = relationship("Supplement")


class SupplementIntakeLog(Base):
    """복용 기록. streak·복용 캘린더 계산용."""
    __tablename__ = "supplement_intake_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    supplement_id = Column(Integer, ForeignKey("supplements.id"), index=True)

    taken_date = Column(Date, index=True)            # 복용 날짜(검색용)
    taken_at = Column(DateTime, default=datetime.now)
    status = Column(String, default="taken")         # taken / skipped


class SupplementReminder(Base):
    """영양제 복용 알림 스케줄. ReminderScheduler 가 읽어 발송."""
    __tablename__ = "supplement_reminders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    supplement_id = Column(Integer, ForeignKey("supplements.id"), index=True)

    time = Column(String)                            # "08:00"
    repeat_days = Column(String, default="daily")    # "daily" 또는 "1,2,3,4,5"(월~금)
    enabled = Column(Boolean, default=True)

    supplement = relationship("Supplement")
