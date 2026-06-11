from sqlalchemy import Column, Integer, String, Float, Text, Date, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class FormCheckLog(Base):
    """
    폼체크(AI 자세 분석) 결과 1건. 영상 분석 사이드카(8003)가 만든 점수·총평을
    로그인 유저 계정에 남겨, Journal 일별 상세에서 그날의 운동·식단·체성분과 함께 본다.

    분석 자체는 무인증 /exercise/analyze_video 가 수행하고, 그 결과를 받은 프론트가
    로그인 상태일 때만 /exercise/formcheck/log 로 저장한다. 오류 프레임 스크린샷은
    용량 부담이 커 저장하지 않고, 5축 카테고리 점수(cat_scores)와 총평까지만 남긴다.
    """
    __tablename__ = "formcheck_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    logged_date = Column(Date, index=True)   # 분석 날짜 (Journal 일별 조인 키)

    exercise_type = Column(String)           # 운동 종류 (예: 스쿼트)
    score = Column(Float)                     # 종합 점수 (0~100)
    rep_count = Column(Integer, nullable=True)
    cat_scores = Column(JSON, nullable=True)   # 5축 점수 {"Stability": 85, ...}
    cat_details = Column(JSON, nullable=True)  # 5축 피드백 {"ROM": "더 깊이 앉으세요", ...}
    overall = Column(Text, nullable=True)      # 한 줄 총평

    created_at = Column(DateTime, default=datetime.now)

    user = relationship("User", backref="formcheck_logs")
