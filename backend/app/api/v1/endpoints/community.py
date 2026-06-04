"""
커뮤니티 CRUD + 좋아요 + 댓글(비밀 포함) 엔드포인트.

엔드포인트 그룹:
  - GET    /posts                     글 목록 (최신순)
  - POST   /posts                     글 작성
  - PATCH  /posts/{id}                글 수정 (본인만)
  - DELETE /posts/{id}                글 삭제 (본인만)
  - POST   /posts/{id}/like           좋아요 토글
  - GET    /posts/{id}/comments       댓글 목록 (비밀댓글 마스킹 적용)
  - POST   /posts/{id}/comments       댓글 작성
  - PATCH  /comments/{id}             댓글 수정 (본인만)
  - DELETE /comments/{id}             댓글 삭제 (본인만)

닉네임은 username 앞 2글자만 노출하고 뒤는 *로 마스킹해서 내려준다.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from pydantic import BaseModel, Field

from app.database import get_db
from app.models.user import User
from app.models.community import CommunityPost, CommunityLike, CommunityComment
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()


# ---------- 마스킹 / 직렬화 ----------

def _mask_nickname(username: Optional[str]) -> str:
    """앞 2글자만 노출 + 나머지 길이만큼 별표 (최대 5개). 짧으면 적당히 줄임."""
    if not username:
        return "익명"
    if len(username) <= 2:
        return username[0] + "*"
    keep = username[:2]
    rest = min(len(username) - 2, 5)
    return keep + ("*" * rest)


def _author_view(user: Optional[User]) -> dict:
    if not user:
        return {"user_id": None, "nickname": "익명", "age": None, "avatar": None}
    # 닉네임을 설정했으면 그대로, 아니면 username 마스킹으로 폴백.
    nick = user.nickname.strip() if user.nickname and user.nickname.strip() else _mask_nickname(user.username)
    return {
        "user_id": user.id,
        "nickname": nick,
        "age": user.age,
        "avatar": user.avatar,
    }


def _serialize_post(
    post: CommunityPost,
    db: Session,
    viewer_id: int,
) -> dict:
    like_count = db.query(func.count(CommunityLike.id)).filter(
        CommunityLike.post_id == post.id
    ).scalar() or 0
    comment_count = db.query(func.count(CommunityComment.id)).filter(
        CommunityComment.post_id == post.id
    ).scalar() or 0
    liked_by_me = db.query(CommunityLike).filter(
        CommunityLike.post_id == post.id,
        CommunityLike.user_id == viewer_id,
    ).first() is not None

    return {
        "id": post.id,
        "author": _author_view(post.user),
        "body": post.body,
        "address": post.address,
        "bench": post.bench,
        "deadlift": post.deadlift,
        "squat": post.squat,
        "like_count": like_count,
        "liked_by_me": liked_by_me,
        "comment_count": comment_count,
        "is_mine": post.user_id == viewer_id,
        "created_at": post.created_at.isoformat() if post.created_at else None,
        "updated_at": post.updated_at.isoformat() if post.updated_at else None,
    }


def _serialize_comment(
    comment: CommunityComment,
    post_author_id: int,
    viewer_id: int,
) -> dict:
    """비밀댓글이면 글쓴이/댓글 작성자만 본문 노출, 그 외엔 자리표시."""
    can_read_secret = (
        not comment.is_secret
        or viewer_id == post_author_id
        or viewer_id == comment.user_id
    )
    return {
        "id": comment.id,
        "author": _author_view(comment.user),
        "body": comment.body if can_read_secret else "비밀댓글입니다.",
        "is_secret": comment.is_secret,
        "is_mine": comment.user_id == viewer_id,
        "can_read": can_read_secret,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
        "updated_at": comment.updated_at.isoformat() if comment.updated_at else None,
    }


# ---------- Pydantic 스키마 ----------

class PostCreate(BaseModel):
    body: str = Field(min_length=1, max_length=5000)
    address: Optional[str] = Field(default=None, max_length=120)
    bench: Optional[float] = None
    deadlift: Optional[float] = None
    squat: Optional[float] = None


class PostUpdate(BaseModel):
    body: Optional[str] = Field(default=None, min_length=1, max_length=5000)
    address: Optional[str] = Field(default=None, max_length=120)
    bench: Optional[float] = None
    deadlift: Optional[float] = None
    squat: Optional[float] = None


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)
    is_secret: bool = False


class CommentUpdate(BaseModel):
    body: Optional[str] = Field(default=None, min_length=1, max_length=2000)
    is_secret: Optional[bool] = None


# ---------- Post ----------

@router.get("/posts")
def list_posts(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    limit = max(1, min(limit, 200))
    posts = (
        db.query(CommunityPost)
        .order_by(desc(CommunityPost.created_at))
        .limit(limit)
        .all()
    )
    return [_serialize_post(p, db, current_user.id) for p in posts]


@router.post("/posts")
def create_post(
    payload: PostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = CommunityPost(
        user_id=current_user.id,
        body=payload.body.strip(),
        address=(payload.address or "").strip() or None,
        bench=payload.bench,
        deadlift=payload.deadlift,
        squat=payload.squat,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return _serialize_post(post, db, current_user.id)


@router.patch("/posts/{post_id}")
def update_post(
    post_id: int,
    payload: PostUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = db.query(CommunityPost).filter(CommunityPost.id == post_id).first()
    if post is None:
        raise HTTPException(status_code=404, detail="글을 찾을 수 없습니다.")
    if post.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인 글만 수정할 수 있습니다.")

    if payload.body is not None:
        post.body = payload.body.strip()
    if payload.address is not None:
        post.address = payload.address.strip() or None
    # 숫자 필드는 None 으로 명시 클리어할 수 있게 set fields exposed 만 반영해야 하지만
    # 단순화: PATCH 페이로드에 키가 있으면 그대로 덮어쓰기. (프론트에선 안 보낼 값을 omit)
    fields_set = payload.model_fields_set if hasattr(payload, "model_fields_set") else set()
    if "bench" in fields_set:
        post.bench = payload.bench
    if "deadlift" in fields_set:
        post.deadlift = payload.deadlift
    if "squat" in fields_set:
        post.squat = payload.squat

    db.commit()
    db.refresh(post)
    return _serialize_post(post, db, current_user.id)


@router.delete("/posts/{post_id}")
def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = db.query(CommunityPost).filter(CommunityPost.id == post_id).first()
    if post is None:
        raise HTTPException(status_code=404, detail="글을 찾을 수 없습니다.")
    if post.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인 글만 삭제할 수 있습니다.")
    db.delete(post)
    db.commit()
    return {"status": "success"}


# ---------- Like ----------

@router.post("/posts/{post_id}/like")
def toggle_like(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """좋아요 토글 — 있으면 지우고 없으면 추가."""
    post = db.query(CommunityPost).filter(CommunityPost.id == post_id).first()
    if post is None:
        raise HTTPException(status_code=404, detail="글을 찾을 수 없습니다.")

    existing = db.query(CommunityLike).filter(
        CommunityLike.post_id == post_id,
        CommunityLike.user_id == current_user.id,
    ).first()

    if existing:
        db.delete(existing)
        db.commit()
        liked = False
    else:
        db.add(CommunityLike(post_id=post_id, user_id=current_user.id))
        db.commit()
        liked = True

    count = db.query(func.count(CommunityLike.id)).filter(
        CommunityLike.post_id == post_id
    ).scalar() or 0
    return {"liked": liked, "like_count": count}


# ---------- Comment ----------

@router.get("/posts/{post_id}/comments")
def list_comments(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = db.query(CommunityPost).filter(CommunityPost.id == post_id).first()
    if post is None:
        raise HTTPException(status_code=404, detail="글을 찾을 수 없습니다.")

    comments = (
        db.query(CommunityComment)
        .filter(CommunityComment.post_id == post_id)
        .order_by(CommunityComment.created_at.asc())
        .all()
    )
    return [_serialize_comment(c, post.user_id, current_user.id) for c in comments]


@router.post("/posts/{post_id}/comments")
def create_comment(
    post_id: int,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = db.query(CommunityPost).filter(CommunityPost.id == post_id).first()
    if post is None:
        raise HTTPException(status_code=404, detail="글을 찾을 수 없습니다.")

    comment = CommunityComment(
        post_id=post_id,
        user_id=current_user.id,
        body=payload.body.strip(),
        is_secret=bool(payload.is_secret),
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return _serialize_comment(comment, post.user_id, current_user.id)


@router.patch("/comments/{comment_id}")
def update_comment(
    comment_id: int,
    payload: CommentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    comment = db.query(CommunityComment).filter(CommunityComment.id == comment_id).first()
    if comment is None:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인 댓글만 수정할 수 있습니다.")

    if payload.body is not None:
        comment.body = payload.body.strip()
    if payload.is_secret is not None:
        comment.is_secret = bool(payload.is_secret)

    db.commit()
    db.refresh(comment)
    post = db.query(CommunityPost).filter(CommunityPost.id == comment.post_id).first()
    return _serialize_comment(comment, post.user_id if post else 0, current_user.id)


@router.delete("/comments/{comment_id}")
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    comment = db.query(CommunityComment).filter(CommunityComment.id == comment_id).first()
    if comment is None:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인 댓글만 삭제할 수 있습니다.")
    db.delete(comment)
    db.commit()
    return {"status": "success"}
