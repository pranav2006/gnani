"""
Password hashing and login tokens.

- Passwords: bcrypt, which salts each hash and is deliberately slow, so a
  leaked database can't be brute-forced cheaply.
- Sessions: a stateless JWT signed with JWT_SECRET (HS256). It holds only
  the user id ("sub") and an expiry. The frontend sends it as
  "Authorization: Bearer <token>" on every request.
"""

import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app import config
from app.database import get_db
from app.models import User


JWT_ALGORITHM = "HS256"

# auto_error=False so we can return our own 401 message (and also accept
# the token as a query parameter for <audio src>, see below).
_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "exp": datetime.now(timezone.utc) + timedelta(days=config.JWT_EXPIRE_DAYS),
    }
    return jwt.encode(payload, config.JWT_SECRET, algorithm=JWT_ALGORITHM)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=401,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _user_from_token(token: str | None, db: Session) -> User:
    if not token:
        raise _unauthorized("Please log in.")

    try:
        # Verifies the signature and the "exp" claim.
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = uuid.UUID(payload["sub"])
    except jwt.ExpiredSignatureError:
        raise _unauthorized("Your session has expired. Please log in again.")
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise _unauthorized("Invalid login token. Please log in again.")

    user = db.get(User, user_id)

    if user is None:
        raise _unauthorized("This account no longer exists.")

    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    return _user_from_token(credentials.credentials if credentials else None, db)


def get_current_user_header_or_query(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    token: str | None = Query(None),
    db: Session = Depends(get_db),
) -> User:
    """
    Same as get_current_user, but also accepts ?token=. An <audio src>
    request is made by the browser itself and can't carry an
    Authorization header, so the audio endpoint needs this.
    """
    return _user_from_token(credentials.credentials if credentials else token, db)
