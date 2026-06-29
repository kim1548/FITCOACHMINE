"""주간 리포트 AI 요약 — 최근 7일 집계(운동·식단·체성분)를 받아
짧은 한국어 총평을 생성한다. inbody_ai 와 같은 Ollama(gemma3:4b) 패턴.
"""
import re
from typing import Optional

import httpx

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "gemma3:4b"

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


def _line(label, value):
    return f"- {label}: {value}"


def build_weekly_prompt(stats: dict, goal: str) -> str:
    lines = []
    lines.append(_line("운동 세션", f"{stats['workout_count']}회"))
    if stats.get("total_volume"):
        lines.append(_line("총 볼륨", f"{int(stats['total_volume'])}kg"))
    lines.append(_line("식단 기록", f"{stats['diet_days']}일"))
    if stats.get("avg_calories"):
        lines.append(_line("일 평균 칼로리", f"{stats['avg_calories']}kcal"))
    if stats.get("avg_protein"):
        lines.append(_line("일 평균 단백질", f"{stats['avg_protein']}g"))
    if stats.get("weight_change") is not None:
        wc = stats["weight_change"]
        lines.append(_line("체중 변화", f"{'+' if wc > 0 else ''}{wc}kg"))
    if stats.get("body_fat_change") is not None:
        fc = stats["body_fat_change"]
        lines.append(_line("체지방률 변화", f"{'+' if fc > 0 else ''}{fc}%p"))

    return (
        "당신은 헬스 코치입니다. 사용자의 지난 한 주(월~일) 기록을 보고 그 주를 돌아보는 "
        "짧은 한국어 주간 총평을 작성하세요.\n"
        "\n"
        f"[사용자 목표] {goal or '미설정'}\n"
        f"[기간] {stats.get('period', '최근 7일')}\n"
        "\n"
        "[지난주 기록]\n"
        + "\n".join(lines) + "\n"
        "\n"
        "[작성 규칙]\n"
        "- 3~4문장, 150자 이내\n"
        "- 잘한 점 하나를 콕 짚어 칭찬하고, 앞으로 신경 쓰면 좋을 점 하나를 제시\n"
        "- 기록이 거의 없으면 부담 주지 말고 가볍게 시작을 독려\n"
        "- 마크다운, 리스트, 이모지, 따옴표 금지\n"
        "- 의학 진단이나 약 추천 금지\n"
        "- 자연스러운 한국어 어미(~해요, ~예요) 사용\n"
        "\n"
        "총평:"
    )


def generate_weekly_summary(stats: dict, goal: str = "") -> Optional[str]:
    """Ollama 호출로 주간 총평 생성. 실패 시 None."""
    prompt = build_weekly_prompt(stats, goal)
    try:
        response = httpx.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "keep_alive": "10m",
                "options": {"temperature": 0.7, "num_predict": 200, "stop": ["\n\n"]},
            },
            timeout=90.0,
        )
        response.raise_for_status()
        raw = (response.json().get("response") or "").strip()
        raw = raw.replace("**", "").replace("*", "")
        raw = _EMOJI.sub("", raw)
        raw = re.sub(r"\s{2,}", " ", raw).strip(" \"'")
        return raw or None
    except Exception as exc:
        print(f"[weekly_ai] Gemma 호출 실패: {exc}")
        return None
