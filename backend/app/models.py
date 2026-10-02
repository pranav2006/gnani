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


# Lifecycle of an upload. The worker moves a row forward through these;
# any stage can jump to FAILED with error_message filled in.
QUEUED = "QUEUED"
PREPROCESSING = "PREPROCESSING"
TRANSCRIBING = "TRANSCRIBING"
SUMMARIZING = "SUMMARIZING"
COMPLETED = "COMPLETED"
FAILED = "FAILED"

TERMINAL_STATUSES = {COMPLETED, FAILED}

# Subscription plans.
PLAN_FREE = "free"
PLAN_PRO = "pro"


class User(Base):

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Stored lower-cased so "A@x.com" and "a@x.com" are one account.
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )

    # bcrypt hash (includes its own salt). The password itself is never stored.
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

    # Nullable only because uploads made before accounts existed have no
    # owner; every new upload sets it. Ownerless rows are visible to no one.
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

    # How many pieces the audio was split into before sending to Gnani.
    chunk_count: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(50),
        default=QUEUED,
        nullable=False,
    )

    # 0-100, shown as the progress bar in the UI.
    progress: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    # Human readable description of what is happening right now,
    # e.g. "Gnani transcribed 3 of 7 chunks".
    stage_detail: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    transcript: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # [{"start": float, "end": float, "text": str}, ...] with timestamps
    # relative to the start of the original file (not the chunk).
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
