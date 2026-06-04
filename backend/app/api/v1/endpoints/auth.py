# backend/app/api/v1/endpoints/auth.py
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash
from pydantic import BaseModel
from fastapi.security import OAuth2PasswordRequestForm
from app.core.security import verify_password, create_access_token
from jose import JWTError, jwt
from app.core.security import SECRET_KEY, ALGORITHM
from fastapi.security import OAuth2PasswordBearer

router = APIRouter()

# DB 세션 연결 함수
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 가입 시 받을 데이터 규격 (Pydantic)
class UserCreate(BaseModel):
    username: str
    password: str
    nickname: Optional[str] = None   # 커뮤니티 표시명 (선택). 비우면 username 마스킹으로 폴백.
    gender: str
    age: int
    height: float
    weight: float
    lifestyle: str
    workout_experience: str
    workout_frequency: str
    fitness_level: str
    goal: str

@router.post("/signup")
def signup(user_data: UserCreate, db: Session = Depends(get_db)):
    # [로그 추가] 데이터가 어떻게 들어오는지 터미널에 찍어봅니다.
    print(f"--- SIGNUP DEBUG ---")
    print(f"Raw Password: {user_data.password}")
    print(f"Type: {type(user_data.password)}")

    # 1. 아이디 중복 확인
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="이미 존재하는 아이디입니다.")

    # 2. 비밀번호 암호화 (강제로 문자열로 변환)
    try:
        raw_password = str(user_data.password) # 확실하게 문자열로 변환
        hashed_pwd = get_password_hash(raw_password)
    except Exception as e:
        print(f"Hashing Error: {e}")
        raise HTTPException(status_code=500, detail=f"암호화 실패: {str(e)}")

    # 3. 유저 생성
    new_user = User(
        username=user_data.username,
        password=hashed_pwd,
        nickname=(user_data.nickname or "").strip() or None,
        gender=user_data.gender,
        age=user_data.age,
        height=user_data.height,
        weight=user_data.weight,
        lifestyle=user_data.lifestyle,
        workout_experience=user_data.workout_experience,
        workout_frequency=user_data.workout_frequency,
        fitness_level=user_data.fitness_level,
        goal=user_data.goal
    )
    
    db.add(new_user)
    db.commit()
    return {"message": "회원가입 성공!"}

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # 1. 유저 찾기
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user:
        raise HTTPException(status_code=400, detail="아이디 또는 비밀번호가 틀렸습니다.")

    # 2. 비밀번호 검증
    if not verify_password(form_data.password, user.password):
        raise HTTPException(status_code=400, detail="아이디 또는 비밀번호가 틀렸습니다.")

    # 3. 로그인 성공! 증표(토큰) 발행
    access_token = create_access_token(data={"sub": user.username})
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "username": user.username # 프론트에서 쓰기 편하게 이름도 같이 줍니다.
    }

def get_current_user(db: Session = Depends(get_db), token: str = Depends(OAuth2PasswordBearer(tokenUrl="api/v1/auth/login"))):
    credentials_exception = HTTPException(
        status_code=401,
        detail="자격 증명을 확인할 수 없습니다.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user