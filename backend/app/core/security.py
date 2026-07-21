# backend/app/core/security.py
import os
import secrets

import bcrypt
from datetime import datetime, timedelta
from jose import jwt

# 운영 환경에서는 FITCOACH_SECRET_KEY 환경변수를 반드시 설정할 것.
# 미설정 시 실행마다 무작위 키가 생성되므로 서버를 재시작하면 기존 토큰이 전부 무효화된다.
SECRET_KEY = os.getenv("FITCOACH_SECRET_KEY") or secrets.token_hex(32)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 1주일


def create_access_token(data: dict):
    """로그인 증표(JWT 토큰)를 생성합니다."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# passlib(2020년 이후 미관리)이 bcrypt 4+ 내부 API 변경을 못 따라가 깨지는 사례가
# 많아 bcrypt 라이브러리를 직접 호출하도록 단순화했다.
# bcrypt 알고리즘 자체는 비밀번호 길이를 72바이트로 제한하므로 그 위는 잘라낸다.

def get_password_hash(password: str) -> str:
    pw_bytes = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pw_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8")[:72],
            hashed_password.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False