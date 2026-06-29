from datetime import datetime
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict
import math

from app.database import get_db
from app.models.routine_log import UserRoutineStats, RoutineLog
from app.models.program_state import UserProgramState
from app.models.user import User
from app.schemas.routine import DailyPlanResponse, RoutineStatUpdate, RoutineStatResponse
from app.services.routine_calculator import RoutineCalculator
from app.services.journal_ai import generate_and_save_ai_comment
from app.api.v1.endpoints.auth import get_current_user
from pydantic import BaseModel

router = APIRouter()

EXERCISE_NAMES_KO = {
    "squat": "스쿼트",
    "bench": "벤치프레스",
    "deadlift": "데드리프트",
    "ohp": "오버헤드 프레스",
    "row": "바벨 로우",
}

# --- 핵심: 하나의 함수에서 모든 /plan 요청을 처리합니다 ---
@router.get("/plan/{routine_id}", response_model=DailyPlanResponse)
def get_daily_plan(routine_id: str, db: Session = Depends(get_db)):
    # 1. 루틴 아이디를 대문자로 변환하여 판별
    rid = routine_id.upper()
    
    # 2. 루틴별 운동 구성 정의 (대기 상태 — 추후 정식 루틴 추가 예정)
    workout_configs = {}

    if rid not in workout_configs:
        return {
            "routine_name": "",
            "day_label": "",
            "exercises": []
        }

    selected_routine = rid
    exercises_to_do = workout_configs[selected_routine]
    
    # 3. 유저의 TM(Training Max) 가져오기
    stats = db.query(UserRoutineStats).all()
    stats_dict = {s.exercise_name: s.training_max for s in stats}

    full_plan_exercises = []

    for ex_name in exercises_to_do:
        tm = stats_dict.get(ex_name, 40.0) # 없으면 기본 40kg
        
        # 5x5 인지 nSuns 인지에 따라 세트/무게 로직 분리 가능
        if selected_routine == "NSUNS":
            # nSuns 스타일 (예시: 고중량 3세트)
            weight = math.floor((tm * 0.9) / 2.5 + 0.5) * 2.5
            main_sets = [{"weight": weight, "reps": 3}, {"weight": weight, "reps": 3}, {"weight": weight, "reps": 3}]
        else:
            # 기본 5x5 스타일
            set_count = 1 if ex_name == "deadlift" else 5
            weight = math.floor(tm / 2.5 + 0.5) * 2.5
            main_sets = [{"weight": weight, "reps": 5} for _ in range(set_count)]
        
        full_plan_exercises.append({
            "name": ex_name,
            "name_ko": EXERCISE_NAMES_KO.get(ex_name, ex_name),
            "warmup_sets": RoutineCalculator.get_warmup_sets(tm),
            "main_sets": main_sets
        })

    return {
        "routine_name": f"Program - {selected_routine}",
        "day_label": f"Workout {selected_routine}",
        "exercises": full_plan_exercises
    }

# --- 나머지 통계 및 업데이트 API (중복 제거) ---

@router.get("/stats")
def get_workout_stats(db: Session = Depends(get_db)):
    logs = db.query(RoutineLog).order_by(RoutineLog.workout_date.desc()).limit(10).all()
    stats = db.query(UserRoutineStats).all()
    
    formatted_history = []
    for l in logs:
        # JSON 데이터에서 운동 이름들만 뽑아옵니다 (ex: "스쿼트, 벤치프레스")
        ex_names = ", ".join([item.get('ex', '') for item in l.session_data]) if l.session_data else "기록 없음"
        
        formatted_history.append({
            "date": l.workout_date.strftime("%Y-%m-%d"),
            "exercise": ex_names, # 이제 모델에 없는 필드 대신 가공한 데이터를 넣습니다
            "weight": l.total_volume, # 개별 무게 대신 오늘 총 볼륨으로 대체하거나 생략
            "success": True 
        })
    
    return {
        "history": formatted_history,
        "current_status": {s.exercise_name: {"1rm": s.current_1rm, "tm": s.training_max} for s in stats}
    }

# 1. 요청 데이터를 받기 위한 스키마 (클래스)
class WorkoutResultRequest(BaseModel):
    routine_name: str
    exercises: List[Dict] # [{'name': 'squat', 'completed_sets': 5, 'weight': 60.0}, ...]

# 2. 운동 완료 처리 API
@router.post("/finish-workout")
def finish_workout(data: WorkoutResultRequest, db: Session = Depends(get_db)):
    # 1. 프론트에서 받은 데이터를 모델이 원하는 JSON 구조로 변환
    session_info = []
    total_vol = 0.0
    
    for ex in data.exercises:
        is_success = (ex['completed_sets'] == 5)
        
        # JSON에 들어갈 상세 정보 구성
        ex_data = {
            "ex": ex['name'],
            "weight": ex['weight'],
            "completed": ex['completed_sets'],
            "success": is_success
        }
        session_info.append(ex_data)
        
        # 총 볼륨 계산 (무게 * 횟수)
        total_vol += (ex['weight'] * ex['completed_sets'] * 5) # 5x5 기준

        # 2. 증량 로직 (UserRoutineStats 업데이트)
        stats = db.query(UserRoutineStats).filter(
            UserRoutineStats.exercise_name == ex['name']
        ).first()
        
        if stats and is_success:
            # 모델에 있는 step_weight(기본 2.5)를 활용하거나 수동 증량
            increment = 5.0 if ex['name'] == 'deadlift' else 2.5
            stats.training_max += increment

    # 3. 모델 저장 (필드명을 모델 정의와 똑같이 맞춤!)
    new_log = RoutineLog(
        user_id=1,  # 임시
        routine_name=data.routine_name,
        workout_date=datetime.now(),
        session_data=session_info,  # <--- 아까 터졌던 부분! JSON으로 통째로 넣음
        total_volume=total_vol
    )
    
    db.add(new_log)
    db.commit()
    return {"status": "success"}


# --- 프로그램 페이지(/program)에서 완료한 운동 세션을 DB에 저장 ---

class SetEntry(BaseModel):
    reps: int
    completed: bool = True


class LiftEntry(BaseModel):
    lift_id: str
    anchor_key: str
    weight: float
    prev_weight: float
    outcome: str = ""
    sets: List[SetEntry] = []

class RoutineLogCreate(BaseModel):
    date: str
    workout: str
    workout_label: str
    duration_sec: int
    lifts: List[LiftEntry]


def _session_volume(lifts: List[LiftEntry]) -> float:
    """완료한 세트만 합산: Σ(무게 × 완료 반복수). 세트 정보가 비어 있으면 0 기여."""
    vol = 0.0
    for lift in lifts:
        done_reps = sum((s.reps or 0) for s in lift.sets if s.completed)
        vol += (lift.weight or 0) * done_reps
    return round(vol, 1)


@router.post("/log")
def create_routine_log(
    data: RoutineLogCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """프론트 program 페이지의 완료된 운동 세션을 로그인 유저 계정에 저장합니다."""
    # 프론트가 보내는 ISO 문자열을 naive datetime으로 변환 (DB의 다른 시각 컬럼과 동일하게)
    try:
        dt = datetime.fromisoformat(data.date.replace("Z", "+00:00"))
        if dt.tzinfo is not None:
            dt = dt.astimezone().replace(tzinfo=None)
    except ValueError:
        dt = datetime.now()

    new_log = RoutineLog(
        user_id=current_user.id,
        routine_name=data.workout_label or data.workout,
        workout_date=dt,
        session_data=[lift.model_dump() for lift in data.lifts],
        total_volume=_session_volume(data.lifts),
        memo=None,
    )
    db.add(new_log)
    db.commit()
    db.refresh(new_log)

    # 응답은 즉시 돌려보내고, 그날의 Journal AI 코멘트는 백그라운드에서 생성
    background_tasks.add_task(generate_and_save_ai_comment, current_user.id, dt.date())

    return {"status": "success", "log_id": new_log.id}


# --- 프로그램 진행 상태(working weight·증량단계 등) 계정 동기화 ---
# 프론트가 localStorage('fiteating.program')로 관리하던 블롭을 서버에 사용자당 1행으로
# 보관해 기기 간 이어하기를 지원한다. 매 변경마다 PUT 되므로 서버가 항상 최신이다.

class ProgramStatePayload(BaseModel):
    state: dict


@router.get("/program-state")
def get_program_state(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = (
        db.query(UserProgramState)
        .filter(UserProgramState.user_id == current_user.id)
        .first()
    )
    if row is None:
        return {"state": None, "updated_at": None}
    return {
        "state": row.state,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.put("/program-state")
def put_program_state(
    payload: ProgramStatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = (
        db.query(UserProgramState)
        .filter(UserProgramState.user_id == current_user.id)
        .first()
    )
    if row is None:
        row = UserProgramState(user_id=current_user.id, state=payload.state)
        db.add(row)
    else:
        row.state = payload.state
    db.commit()
    db.refresh(row)
    return {
        "status": "success",
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }
