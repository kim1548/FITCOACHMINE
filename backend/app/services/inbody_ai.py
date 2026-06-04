"""
InBody(체성분) 측정 AI 코멘트 생성 서비스.

방금 저장된 측정 1개를 받아 직전 측정과 비교한 짧은 한국어 코멘트를 만들고
InBodyLog.ai_comment 컬럼에 캐시한다. 직전 측정이 없으면(=첫 측정) baseline
평가 모드로 다른 프롬프트를 쓴다.

journal_ai 와 구조는 비슷하지만 저장 위치(InBodyLog)와 프롬프트가 다르다.
외부 호출 진입점은 `generate_and_save_body_comment(log_id)` 하나.
"""

import re
from datetime import datetime
from typing import Optional

import httpx
from sqlalchemy.orm import Session

# 이모지/그림문자 제거용 (프롬프트에 '이모지 금지'라 적어도 모델이 종종 넣음)
_EMOJI = re.compile(
    "["
    "\U0001F300-\U0001FAFF"   # 그림문자·이모티콘·교통·보조기호
    "\U00002600-\U000027BF"   # 기타기호 + 딩뱃
    "\U0001F1E6-\U0001F1FF"   # 국기
    "\U0000FE00-\U0000FE0F"   # 변형 선택자
    "\U00002190-\U000021FF"   # 화살표류
    "\U00002B00-\U00002BFF"   # 별·도형 등
    "]+",
    flags=re.UNICODE,
)

from app.database import SessionLocal
from app.models.user import User
from app.models.inbody_log import InBodyLog


OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "gemma3:4b"


def _fmt_metric(label: str, value, unit: str) -> str:
    if value is None:
        return f"- {label}: 측정 안 됨"
    return f"- {label}: {value}{unit}"


def _fmt_delta(label: str, curr, prev, unit: str) -> str:
    if curr is None or prev is None:
        return f"- {label}: {curr if curr is not None else '미측정'}{unit}"
    diff = round(curr - prev, 1)
    sign = "+" if diff > 0 else ""
    return f"- {label}: {curr}{unit} ({sign}{diff}{unit})"


def _build_baseline_prompt(user: User, log: InBodyLog) -> str:
    body = f"{user.height}cm" if user.height else "신체 정보 없음"
    goal = user.goal or "미설정"
    return (
        "당신은 체성분 코치입니다. 사용자가 방금 첫 InBody 측정을 마쳤습니다. "
        "베이스라인을 인정하고 다음 측정에서 기대되는 변화 방향을 짚어주는 짧은 한국어 코멘트를 작성하세요.\n"
        "\n"
        "[사용자 정보]\n"
        f"- 목표: {goal}\n"
        f"- 신체: {body}\n"
        "\n"
        "[첫 측정 결과]\n"
        f"{_fmt_metric('체중', log.weight, 'kg')}\n"
        f"{_fmt_metric('골격근량', log.skeletal_muscle, 'kg')}\n"
        f"{_fmt_metric('체지방량', log.body_fat_mass, 'kg')}\n"
        f"{_fmt_metric('체지방률', log.body_fat_percent, '%')}\n"
        f"{_fmt_metric('기초대사량', log.bmr, 'kcal')}\n"
        "\n"
        "[작성 규칙]\n"
        "- 2~3문장, 100자 이내\n"
        "- 시작점을 인정하고 다음 측정에서 노릴 한 가지 변화 방향만 제시\n"
        "- 마크다운, 리스트, 이모지, 따옴표 사용 금지\n"
        "- 의학 진단이나 약 추천 금지\n"
        "- 자연스러운 한국어 어미(~해요, ~예요) 사용\n"
        "\n"
        "코멘트:"
    )


def _build_comparison_prompt(user: User, curr: InBodyLog, prev: InBodyLog) -> str:
    body = f"{user.height}cm" if user.height else "신체 정보 없음"
    goal = user.goal or "미설정"
    return (
        "당신은 체성분 코치입니다. 사용자의 이번 InBody 측정과 직전 측정을 비교해 "
        "변화 방향이 목표에 맞는지 짚어주는 짧은 한국어 코멘트를 작성하세요.\n"
        "\n"
        "[사용자 정보]\n"
        f"- 목표: {goal}\n"
        f"- 신체: {body}\n"
        "\n"
        f"[직전 측정 — {prev.measured_at.isoformat() if prev.measured_at else '?'}]\n"
        f"{_fmt_metric('체중', prev.weight, 'kg')}\n"
        f"{_fmt_metric('골격근량', prev.skeletal_muscle, 'kg')}\n"
        f"{_fmt_metric('체지방량', prev.body_fat_mass, 'kg')}\n"
        f"{_fmt_metric('체지방률', prev.body_fat_percent, '%')}\n"
        "\n"
        f"[이번 측정 — {curr.measured_at.isoformat() if curr.measured_at else '?'}]\n"
        f"{_fmt_delta('체중', curr.weight, prev.weight, 'kg')}\n"
        f"{_fmt_delta('골격근량', curr.skeletal_muscle, prev.skeletal_muscle, 'kg')}\n"
        f"{_fmt_delta('체지방량', curr.body_fat_mass, prev.body_fat_mass, 'kg')}\n"
        f"{_fmt_delta('체지방률', curr.body_fat_percent, prev.body_fat_percent, '%')}\n"
        "\n"
        "[작성 규칙]\n"
        "- 2~3문장, 100자 이내\n"
        "- 가장 의미 있는 변화 한 가지를 콕 짚어 평가 (목표 부합 여부 포함)\n"
        "- 다음까지 신경 쓰면 좋을 짧은 팁 하나\n"
        "- 마크다운, 리스트, 이모지, 따옴표 사용 금지\n"
        "- 의학 진단이나 약 추천 금지\n"
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
                "keep_alive": "10m",   # 모델을 메모리에 유지 → 다음 호출의 재로딩 지연 제거
                "options": {
                    "temperature": 0.7,
                    "num_predict": 150,  # 코멘트는 100자 이내라 토큰을 줄여 생성시간 단축
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
        print(f"[inbody_ai] Gemma 호출 실패: {exc}")
        return None


def _find_previous(db: Session, log: InBodyLog) -> Optional[InBodyLog]:
    """같은 유저의 측정 중 이 측정보다 시간적으로 앞선 가장 가까운 1개.

    같은 날 여러 측정이 있을 때를 대비해 measured_at 동률이면 created_at 으로 분기.
    """
    return (
        db.query(InBodyLog)
        .filter(InBodyLog.user_id == log.user_id, InBodyLog.id != log.id)
        .filter(
            (InBodyLog.measured_at < log.measured_at)
            | (
                (InBodyLog.measured_at == log.measured_at)
                & (InBodyLog.created_at < log.created_at)
            )
        )
        .order_by(InBodyLog.measured_at.desc(), InBodyLog.created_at.desc())
        .first()
    )


def generate_and_save_body_comment(log_id: int) -> Optional[str]:
    """
    BackgroundTasks / 수동 재생성 양쪽에서 부르는 단일 진입점.

    1. log 조회 (없으면 조용히 종료)
    2. 같은 유저의 직전 측정 조회
    3. prev 유무에 따라 baseline / comparison 프롬프트 생성
    4. Gemma 호출 → 실패 시 종료 (다음 호출에서 재시도 가능)
    5. log.ai_comment / ai_generated_at 업데이트 후 commit
    """
    db = SessionLocal()
    try:
        log = db.query(InBodyLog).filter(InBodyLog.id == log_id).first()
        if log is None:
            return None
        user = db.query(User).filter(User.id == log.user_id).first()
        if user is None:
            return None

        prev = _find_previous(db, log)
        prompt = (
            _build_comparison_prompt(user, log, prev)
            if prev is not None
            else _build_baseline_prompt(user, log)
        )

        comment = _call_gemma(prompt)
        if comment is None:
            return None

        log.ai_comment = comment
        log.ai_generated_at = datetime.now()
        db.commit()
        return comment
    finally:
        db.close()
