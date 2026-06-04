"""
사용자 프로필 + 영양 목표 조회 / 회원 탈퇴 엔드포인트.

프론트가 매번 두 번 호출하는 대신, /me 한 번이면 프로필과 계산된 목표를 같이
얻을 수 있게 합쳤다. 영양 목표 계산이 불가능하면 nutrition: null.

DELETE /me 는 회원 탈퇴 — 자신과 관련된 모든 로그를 함께 삭제한다.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.routine_log import RoutineLog, UserRoutineStats
from app.models.diet_log import DietLog
from app.models.journal_entry import JournalEntry
from app.api.v1.endpoints.auth import get_current_user
from app.services.nutrition import calc_nutrition_targets

router = APIRouter()


@router.get("/me")
def get_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    nutrition = calc_nutrition_targets(current_user)
    return {
        "username": current_user.username,
        "gender": current_user.gender,
        "age": current_user.age,
        "height": current_user.height,
        "weight": current_user.weight,
        "lifestyle": current_user.lifestyle,
        "workout_experience": current_user.workout_experience,
        "workout_frequency": current_user.workout_frequency,
        "fitness_level": current_user.fitness_level,
        "goal": current_user.goal,
        "nickname": current_user.nickname,
        "avatar": current_user.avatar,
        "nutrition": nutrition,
    }


class ProfileUpdate(BaseModel):
    nickname: Optional[str] = None
    avatar: Optional[str] = None


@router.patch("/me")
def update_me(
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """프로필(닉네임·아바타) 수정. 닉네임은 중복 허용 표시명, avatar 는 프리셋 id.
    값이 빈 문자열이면 NULL 로 비워(마스킹 폴백). 전달 안 된 필드는 그대로 둔다.

    current_user 는 다른 세션에서 로드되므로, 주입된 db 세션에서 다시 조회해
    수정한다(기존 delete_me 패턴)."""
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    if payload.nickname is not None:
        nn = payload.nickname.strip()
        if len(nn) > 20:
            raise HTTPException(status_code=400, detail="닉네임은 20자 이하여야 합니다.")
        user.nickname = nn or None
    if payload.avatar is not None:
        av = payload.avatar.strip()
        if len(av) > 40:
            raise HTTPException(status_code=400, detail="아바타 값이 올바르지 않습니다.")
        user.avatar = av or None
    db.commit()
    db.refresh(user)
    return {"nickname": user.nickname, "avatar": user.avatar}


@router.delete("/me")
def delete_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """현재 로그인한 유저와 그에 연결된 모든 기록을 영구 삭제한다.
    한 트랜잭션으로 묶어 일부만 삭제되는 일이 없도록 한다."""
    uid = current_user.id
    try:
        db.query(JournalEntry).filter(JournalEntry.user_id == uid).delete()
        db.query(DietLog).filter(DietLog.user_id == uid).delete()
        db.query(RoutineLog).filter(RoutineLog.user_id == uid).delete()
        db.query(UserRoutineStats).filter(UserRoutineStats.user_id == uid).delete()
        db.query(User).filter(User.id == uid).delete()
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"탈퇴 처리 실패: {e}")
    return {"status": "success", "message": "회원 탈퇴가 완료되었습니다."}
