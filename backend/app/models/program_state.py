from sqlalchemy import Column, Integer, JSON, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base


class UserProgramState(Base):
    """프로그램(/program) 진행 상태를 로그인 계정에 사용자당 1행으로 저장한다.

    프론트가 localStorage('fiteating.program')로만 들고 있던 블롭
    (selectedId·weights·workingWeights·consecutiveFails·stages 등)을 그대로 보관해,
    다른 기기에서 로그인해도 진행 상태가 이어지게 한다.
    """
    __tablename__ = "user_program_state"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, index=True)
    state = Column(JSON)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    user = relationship("User", backref="program_state")
