# backend/app/main.py
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqladmin import Admin, ModelView
# 새로 만든 구조에서 가져오기
from app.database import engine, Base
from app.models.user import User
from app.models.diet_log import DietLog
from app.models.exercise_log import WorkoutLog
from app.models.journal_entry import JournalEntry  # noqa: F401  (테이블 자동 생성용)
from app.models.inbody_log import InBodyLog  # noqa: F401  (테이블 자동 생성용)
from app.models.formcheck_log import FormCheckLog  # noqa: F401  (테이블 자동 생성용)
from app.models.community import (  # noqa: F401  (테이블 자동 생성용)
    CommunityPost, CommunityLike, CommunityComment,
)
from app.models.supplement import (  # noqa: F401  (테이블 자동 생성용)
    NutrientRDA, Supplement, SupplementIngredient, InteractionRule,
)
from app.models.supplement_user import (  # noqa: F401  (테이블 자동 생성용)
    UserHealthProfile, SupplementRecommendation,
    SupplementIntakeLog, SupplementReminder, UserSupplement,
)
# 기존 라우터들
from app.api.v1.endpoints import exercise, diet, auth

from pydantic import BaseModel  # 추가
import httpx
from fastapi.staticfiles import StaticFiles
from app.api.v1.endpoints import (
    routine, journal, user as user_endpoint, body as body_endpoint,
    community as community_endpoint, report as report_endpoint,
    supplement as supplement_endpoint,
)
from sqlalchemy import inspect, text

app = FastAPI()

# 2. 허용할 Origin(프론트엔드 주소) 목록 작성
origins = [
    "http://localhost:5173",  # 리액트 Vite 기본 포트
    "http://127.0.0.1:5173",
]

# CORS 설정 (기존 유지)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    # allow_origins=origins, # 리액트 주소
    allow_credentials=True,
    allow_methods=["*"], # 모든 방식(GET, POST 등) 허용
    allow_headers=["*"], # 모든 헤더 허용
)

# 테이블 생성 (이 한 줄이 모든 모델의 테이블을 test.db에 만듭니다)
Base.metadata.create_all(bind=engine)


def _ensure_users_age_column():
    """create_all 은 기존 테이블에 새 컬럼을 추가하지 않으므로, users.age 가
    빠져있으면 한 번만 ALTER TABLE 로 채워준다."""
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("users")}
    if "age" not in cols:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN age INTEGER"))
            conn.commit()
        print("✅ users.age 컬럼 추가됨 (기존 유저는 NULL)")


def _ensure_inbody_ai_columns():
    """create_all 후에도 기존 inbody_logs 테이블엔 ai_comment / ai_generated_at 이
    없을 수 있어 한 번만 ALTER TABLE 로 채워준다."""
    inspector = inspect(engine)
    if "inbody_logs" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("inbody_logs")}
    with engine.connect() as conn:
        if "ai_comment" not in cols:
            conn.execute(text("ALTER TABLE inbody_logs ADD COLUMN ai_comment TEXT"))
            print("✅ inbody_logs.ai_comment 컬럼 추가됨")
        if "ai_generated_at" not in cols:
            conn.execute(text("ALTER TABLE inbody_logs ADD COLUMN ai_generated_at DATETIME"))
            print("✅ inbody_logs.ai_generated_at 컬럼 추가됨")
        conn.commit()


def _ensure_users_profile_columns():
    """create_all 은 기존 테이블에 새 컬럼을 추가하지 않으므로, users 에
    nickname / avatar 가 빠져있으면 한 번만 ALTER TABLE 로 채워준다."""
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("users")}
    with engine.connect() as conn:
        if "nickname" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN nickname VARCHAR"))
            print("✅ users.nickname 컬럼 추가됨 (기존 유저는 NULL)")
        if "avatar" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN avatar VARCHAR"))
            print("✅ users.avatar 컬럼 추가됨 (기존 유저는 NULL)")
        conn.commit()


def _ensure_formcheck_columns():
    """create_all 은 기존 테이블에 새 컬럼을 추가하지 않으므로, formcheck_logs 에
    cat_details 가 빠져있으면 한 번만 ALTER TABLE 로 채워준다."""
    inspector = inspect(engine)
    if "formcheck_logs" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("formcheck_logs")}
    if "cat_details" not in cols:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE formcheck_logs ADD COLUMN cat_details JSON"))
            conn.commit()
        print("✅ formcheck_logs.cat_details 컬럼 추가됨")


def _ensure_supplement_columns():
    """create_all 후에도 기존 supplements 테이블엔 price/buy_url/rating 이 없을 수
    있어 한 번만 ALTER TABLE 로 채워준다(실제 브랜드 제품 시드용)."""
    inspector = inspect(engine)
    if "supplements" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("supplements")}
    adds = {"price": "FLOAT", "buy_url": "VARCHAR", "rating": "FLOAT"}
    with engine.connect() as conn:
        for name, ddl in adds.items():
            if name not in cols:
                conn.execute(text(f"ALTER TABLE supplements ADD COLUMN {name} {ddl}"))
                print(f"✅ supplements.{name} 컬럼 추가됨")
        conn.commit()


def _ensure_health_profile_columns():
    """기존 user_health_profiles 테이블에 concerns(건강 고민) 컬럼이 없으면 보강."""
    inspector = inspect(engine)
    if "user_health_profiles" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("user_health_profiles")}
    if "concerns" not in cols:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE user_health_profiles ADD COLUMN concerns JSON"))
            conn.commit()
        print("✅ user_health_profiles.concerns 컬럼 추가됨")


_ensure_users_age_column()
_ensure_inbody_ai_columns()
_ensure_users_profile_columns()
_ensure_formcheck_columns()
_ensure_supplement_columns()
_ensure_health_profile_columns()

# 1. 현재 main.py 파일의 위치를 기준으로 경로 설정
# main.py가 backend/app/main.py에 있다면:
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__)) # backend/app
STATIC_DIR = os.path.join(CURRENT_DIR, "static")

# 2. 경로가 실제로 존재하는지 확인 (디버깅용)
if not os.path.exists(STATIC_DIR):
    print(f"❌ 설정된 경로에 폴더가 없습니다: {STATIC_DIR}")
else:
    print(f"✅ 정적 파일 경로 연결됨: {STATIC_DIR}")

# --- 관리자 페이지 설정 (컬럼 상세화) ---
admin = Admin(app, engine)

class UserAdmin(ModelView, model=User):
    # 회원가입 상세 정보들을 리스트에서 볼 수 있게 추가
    column_list = [
        "id", "username", "gender", "height", "weight", 
        "lifestyle", "goal", "created_at"
    ]
    name = "회원 관리"
    icon = "fa-solid fa-user"

class DietAdmin(ModelView, model=DietLog):
    # 탄단지 영양소 정보를 리스트에 표시
    column_list = [
        "id", "meal_type", "food_name", "calories", 
        "carbs", "protein", "fat", "date"
    ]
    name = "식단 관리"
    icon = "fa-solid fa-utensils"

class WorkoutLogAdmin(ModelView, model=WorkoutLog):
    column_list = ["id", "exercise_name", "counter", "score", "created_at"]
    name = "운동 기록"
    icon = "fa-solid fa-dumbbell"

admin.add_view(UserAdmin)
admin.add_view(DietAdmin)
admin.add_view(WorkoutLogAdmin)
# --- 관리자 페이지 설정 (컬럼 상세화) ---

# 라우터 등록
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(exercise.router, prefix="/api/v1/exercise", tags=["exercise"])
app.include_router(diet.router, prefix="/api/v1/diet", tags=["diet"])
app.include_router(routine.router, prefix="/api/v1/routine", tags=["routine"])
app.include_router(journal.router, prefix="/api/v1/journal", tags=["journal"])
app.include_router(user_endpoint.router, prefix="/api/v1/user", tags=["user"])
app.include_router(body_endpoint.router, prefix="/api/v1/body", tags=["body"])
app.include_router(community_endpoint.router, prefix="/api/v1/community", tags=["community"])
app.include_router(report_endpoint.router, prefix="/api/v1/report", tags=["report"])
app.include_router(supplement_endpoint.router, prefix="/api/v1/supplement", tags=["supplement"])
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def read_root():
    return {"status": "online", "message": "Fit-Eating API Server"}

# 1. 데이터를 받을 구조 정의 (프론트에서 보낸 키값과 일치해야 함)
class FeedbackRequest(BaseModel):
    workout_data: str = ""
    food_data: str = ""
    type: str = "DEFAULT"  # 👈 이렇게 기본값을 주면 에러(422)를 방지할 수 있습니다.

@app.post("/api/v1/ai-feedback")
async def get_feedback(data: FeedbackRequest):  # data 객체로 받음
    # 1. 페이지 타입별 프롬프트 사전(Dictionary) 정의
    prompts = {
        # 전체 식단 페이지용
        "TOTAL_DIET": f"너는 영양사야. 오늘의 전체 영양소({data.food_data})를 보고 하루 총평을 2줄로 해줘.",
        
        # 아침 식사 전용 (아침에 맞는 조언)
        "BREAKFAST": f"너는 식단 코치야. 아침 식사({data.food_data}) 구성을 보고 하루의 시작을 위한 피드백을 2줄로 해줘.",
        
        # 운동 결과 페이지용
        "EXERCISE_RESULT": f"너는 전문 트레이너야. 방금 마친 {data.workout_data} 기록을 보고 자세나 강도에 대해 2줄로 칭찬해줘.",
        
        # 메인 대시보드용 (종합 피드백)
        "DASHBOARD": f"너는 건강 관리사야. 오늘의 운동({data.workout_data})과 식단({data.food_data})을 종합해서 짧게 한마디 해줘."
    }

    # 2. 전송된 type에 맞는 프롬프트 선택 (없으면 기본 프롬프트)
    selected_prompt = prompts.get(data.type, "너는 건강 도우미야. 데이터에 대해 짧게 조언해줘.")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": "gemma3:4b",
                    "prompt": selected_prompt,
                    "stream": False
                },
                timeout=60.0
            )
            result = response.json()
            return {"feedback": result['response']}
        except Exception as e:
            return {"feedback": f"Ollama 연결 실패: {str(e)}"}