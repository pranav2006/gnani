import uuid

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)

from sqlalchemy.dialects.postgresql import JSONB, UUID

from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


QUEUED = "QUEUED"
PREPROCESSING = "PREPROCESSING"
TRANSCRIBING = "TRANSCRIBING"
SUMMARIZING = "SUMMARIZING"
COMPLETED = "COMPLETED"
FAILED = "FAILED"

TERMINAL_STATUSES = {COMPLETED, FAILED}

PLAN_FREE = "free"
PLAN_PRO = "pro"


class User(Base):

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    plan: Mapped[str] = mapped_column(
        String(20),
        default=PLAN_FREE,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )


class AudioUpload(Base):

    __tablename__ = "audio_uploads"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=True,
    )

    filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    storage_key: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    size_bytes: Mapped[int | None] = mapped_column(
        BigInteger,
        nullable=True,
    )

    duration_seconds: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    language_code: Mapped[str] = mapped_column(
        String(20),
        default="en-IN",
        nullable=False,
    )

    gnani_job_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    chunk_count: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(50),
        default=QUEUED,
        nullable=False,
    )

    progress: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    stage_detail: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    transcript: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    segments: Mapped[list | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    summary: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
