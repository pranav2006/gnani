import re
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import config, models
from app.database import get_db
from app.models import AudioUpload, User
from app.services.auth import create_token, get_current_user, hash_password, verify_password


router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)


EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class Credentials(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    plan: str
    created_at: datetime
    uploads_used: int
    upload_limit: int | None


class AuthResponse(BaseModel):
    token: str
    user: UserOut


def upload_limit_for(user: User) -> int | None:
    return None if user.plan == models.PLAN_PRO else config.FREE_UPLOAD_LIMIT


def count_uploads(db: Session, user: User) -> int:
    return db.scalar(
        select(func.count()).select_from(AudioUpload).where(AudioUpload.user_id == user.id)
    )


def user_out(db: Session, user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        plan=user.plan,
        created_at=user.created_at,
        uploads_used=count_uploads(db, user),
        upload_limit=upload_limit_for(user),
    )


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(body: Credentials, db: Session = Depends(get_db)):
    email = body.email.strip().lower()

    if not EMAIL_PATTERN.match(email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

    if not 8 <= len(body.password.encode()) <= 72:
        raise HTTPException(status_code=400, detail="Password must be 8 to 72 characters long.")

    user = User(email=email, password_hash=hash_password(body.password))
    db.add(user)

    try:
        db.commit()
    except IntegrityError:
        # unique email
        db.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    db.refresh(user)
    return AuthResponse(token=create_token(user), user=user_out(db, user))


@router.post("/login", response_model=AuthResponse)
def login(body: Credentials, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))

    # same message for both
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    return AuthResponse(token=create_token(user), user=user_out(db, user))


@router.get("/me", response_model=UserOut)
def me(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return user_out(db, user)


@router.post("/upgrade", response_model=UserOut)
def upgrade(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user.plan = models.PLAN_PRO
    db.commit()
    return user_out(db, user)
