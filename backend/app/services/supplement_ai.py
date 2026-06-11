"""
영양제 추천 이유 AI 코멘트 생성 서비스.

추천 결과 1건(SupplementRecommendation)을 받아 "왜 이 영양제인지" 짧은 한국어
코멘트를 만들어 ai_comment 컬럼에 캐시한다. inbody_ai 와 동일 구조(_call_gemma,
단일 진입점, SessionLocal). 다른 점은 프롬프트 톤 — 추천 목적이라 '정보 제공 +
전문가 상담 권유'로 작성(의료행위 단정 금지).

외부 진입점: generate_and_save_reco_comment(reco_id)
"""

import re
from datetime import datetime
from typing import Optional

import httpx

from app.database import SessionLocal
from app.models.user import User
from app.models.supplement import Supplement
from app.models.supplement_user import SupplementRecommendation

# inbody_ai 와 동일한 이모지 제거 정규식
_EMOJI = re.compile(
    "["
    "\U0001F300-\U0001FAFF"
    "\U00002600-\U000027BF"
    "\U0001F1E6-\U0001F1FF"
    "\U0000FE00-\U0000FE0F"
    "\U00002190-\U000021FF"
    "\U00002B00-\U00002BFF"
    "]+",
    flags=re.UNICODE,
)

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "gemma3:4b"


def _build_prompt(user: User, supp: Supplement, covered: list) -> str:
    goal = user.goal or "미설정"
    nutrients = ", ".join(c.get("name", c.get("code", "")) for c in covered) or "주요 영양소"
    return (
        "당신은 영양 정보 도우미입니다. 아래 사용자에게 이 영양제를 추천하는 이유를 "
        "짧고 친근한 한국어로 설명하세요.\n"
        "\n"
        "[사용자]\n"
        f"- 목표: {goal}\n"
        f"- 부족 추정 영양소: {nutrients}\n"
        "\n"
        "[추천 영양제]\n"
        f"- 제품: {supp.name}\n"
        f"- 분류: {supp.category}\n"
        "\n"
        "[작성 규칙]\n"
        "- 2문장, 90자 이내\n"
        "- 부족 영양소와 이 영양제의 연결을 한 가지만 콕 짚기\n"
        "- 마크다운, 리스트, 이모지, 따옴표 사용 금지\n"
        "- '진단·치료' 단정 금지, '도움이 될 수 있어요' 톤\n"
        "- 마지막에 전문가 상담을 권하는 한 마디\n"
        "- 자연스러운 한국어 어미(~해요, ~예요) 사용\n"
        "\n"
        "코멘트:"
    )


def _call_gemma(prompt: str) -> Optional[str]:
    """Ollama 로컬 서버 호출. 실패는 None — 호출자가 조용히 넘어갈 수 있게."""
    try:
        response = httpx.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "keep_alive": "10m",
                "options": {
                    "temperature": 0.7,
                    "num_predict": 150,
                    "stop": ["\n\n"],
                },
            },
            timeout=90.0,
        )
        response.raise_for_status()
        raw = (response.json().get("response") or "").strip()
        raw = raw.replace("**", "").replace("*", "")
        raw = _EMOJI.sub("", raw)
        raw = re.sub(r"\s{2,}", " ", raw).strip(' "\'')
        return raw or None
    except Exception as exc:
        print(f"[supplement_ai] Gemma 호출 실패: {exc}")
        return None


def generate_and_save_reco_comment(reco_id: int) -> Optional[str]:
    """BackgroundTasks / 수동 재생성 공용 단일 진입점."""
    db = SessionLocal()
    try:
        reco = db.query(SupplementRecommendation).filter(
            SupplementRecommendation.id == reco_id
        ).first()
        if reco is None:
            return None
        user = db.query(User).filter(User.id == reco.user_id).first()
        supp = db.query(Supplement).filter(Supplement.id == reco.supplement_id).first()
        if user is None or supp is None:
            return None

        covered = (reco.reason_json or {}).get("covered", []) if reco.reason_json else []
        comment = _call_gemma(_build_prompt(user, supp, covered))
        if comment is None:
            return None

        reco.ai_comment = comment
        reco.ai_generated_at = datetime.now()
        db.commit()
        return comment
    finally:
        db.close()
