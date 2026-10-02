import re
import tempfile
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import config, models
from app.database import get_db
from app.api.auth import count_uploads, upload_limit_for
from app.models import AudioUpload, User
from app.services import audio, storage
from app.services.auth import get_current_user, get_current_user_header_or_query
from app.worker.tasks import process_audio


router = APIRouter(
    prefix="/uploads",
    tags=["uploads"],
)


ALLOWED_EXTENSIONS = {
    ".wav", ".mp3", ".m4a", ".aac", ".ogg", ".opus",
    ".flac", ".webm", ".mp4", ".amr",
}

# Batch STT languages from Gnani's docs.
ALLOWED_LANGUAGES = {
    "en-IN", "hi-IN", "bn-IN", "kn-IN",
    "ml-IN", "mr-IN", "ta-IN", "te-IN",
}

READ_CHUNK_BYTES = 1024 * 1024


class UploadSummary(BaseModel):
    id: uuid.UUID
    filename: str
    status: str
    progress: int
    stage_detail: str | None
    duration_seconds: float | None
    language_code: str
    error_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class UploadDetail(UploadSummary):
    size_bytes: int | None
    chunk_count: int | None
    transcript: str | None
    segments: list | None
    summary: str | None
    updated_at: datetime


def _safe_filename(name: str | None) -> str:
    # Never trust a client filename: strip directories (path traversal)
    # and anything that isn't a plain filename character.
    base = Path(name or "audio").name
    cleaned = re.sub(r"[^A-Za-z0-9._ -]", "_", base).strip() or "audio"
    return cleaned[:200]


def _get_upload_or_404(db: Session, upload_id: uuid.UUID, user: User) -> AudioUpload:
    upload = db.get(AudioUpload, upload_id)

    # Someone else's upload gets the same 404 as a missing one, so ids
    # can't be probed to learn what exists.
    if upload is None or upload.user_id != user.id:
        raise HTTPException(status_code=404, detail="Upload not found.")

    return upload


def _check_quota(db: Session, user: User, lock: bool = False) -> None:
    limit = upload_limit_for(user)

    if limit is None:
        return

    if lock:
        # Lock this user's row until the transaction commits, so two
        # uploads sent at the same moment can't both pass the count
        # check and go over the limit.
        db.execute(select(User.id).where(User.id == user.id).with_for_update())

    if count_uploads(db, user) >= limit:
        # 402 Payment Required: the frontend shows the upgrade prompt.
        raise HTTPException(
            status_code=402,
            detail=(
                f"You've used all {limit} uploads on the free plan. "
                "Upgrade to Pro for unlimited uploads."
            ),
        )


def _enqueue(db: Session, upload: AudioUpload) -> None:
    try:
        process_audio.delay(str(upload.id))
    except Exception as e:
        # Queue (Redis) is down: don't leave the row stuck in QUEUED.
        upload.status = models.FAILED
        upload.error_message = f"Could not queue the job for processing: {e}"
        db.commit()
        raise HTTPException(
            status_code=503,
            detail="The processing queue is unavailable. Please try again.",
        )


# A plain "def" (not async): ffprobe, the bucket upload and the DB calls
# are all blocking, so FastAPI runs this in its threadpool instead of
# blocking the event loop for every other request.
@router.post("/", response_model=UploadDetail, status_code=201)
def create_upload(
    file: UploadFile = File(...),
    language_code: str = Form("en-IN"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Fail fast before receiving a possibly huge file. Checked again
    # under a lock just before the row is inserted.
    _check_quota(db, user)

    filename = _safe_filename(file.filename)
    extension = Path(filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported file type '{extension or 'none'}'. "
                f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            ),
        )

    if language_code not in ALLOWED_LANGUAGES:
        raise HTTPException(status_code=400, detail="Unsupported language.")

    upload_id = uuid.uuid4()
    max_bytes = config.MAX_UPLOAD_MB * 1024 * 1024

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir) / f"upload{extension}"

        # Stream to disk in 1 MB pieces instead of reading the whole
        # file into memory, and stop early if it is too large.
        size = 0
        with open(temp_path, "wb") as buffer:
            while piece := file.file.read(READ_CHUNK_BYTES):
                size += len(piece)
                if size > max_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File is larger than {config.MAX_UPLOAD_MB} MB.",
                    )
                buffer.write(piece)

        if size == 0:
            raise HTTPException(status_code=400, detail="The file is empty.")

        # Quick synchronous check (ffprobe reads only the header, so it
        # takes milliseconds) so obviously broken files are rejected
        # immediately instead of failing later in the background.
        try:
            duration = audio.probe_duration(str(temp_path))
        except audio.AudioError as e:
            raise HTTPException(status_code=400, detail=str(e))

        storage_key = f"uploads/{upload_id}/{filename}"

        try:
            storage.save_file(str(temp_path), storage_key)
        except Exception as e:
            print(f"Storage upload failed: {e!r}")
            raise HTTPException(
                status_code=502,
                detail="Could not save the file to storage. Please try again.",
            )

    _check_quota(db, user, lock=True)

    upload = AudioUpload(
        id=upload_id,
        user_id=user.id,
        filename=filename,
        storage_key=storage_key,
        size_bytes=size,
        duration_seconds=duration,
        language_code=language_code,
        status=models.QUEUED,
        progress=2,
        stage_detail="Waiting for a worker to pick up the job",
    )

    db.add(upload)
    db.commit()
    db.refresh(upload)

    _enqueue(db, upload)

    return upload


@router.get("/", response_model=list[UploadSummary])
def list_uploads(
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = (
        select(AudioUpload)
        .where(AudioUpload.user_id == user.id)
        .order_by(AudioUpload.created_at.desc())
        .limit(min(limit, 200))
    )
    return db.scalars(query).all()


@router.get("/{upload_id}", response_model=UploadDetail)
def get_upload(
    upload_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_upload_or_404(db, upload_id, user)


@router.post("/{upload_id}/retry", response_model=UploadDetail)
def retry_upload(
    upload_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # A retry re-processes an existing upload, so it doesn't use quota.
    upload = _get_upload_or_404(db, upload_id, user)

    if upload.status != models.FAILED:
        raise HTTPException(
            status_code=409,
            detail="Only failed uploads can be retried.",
        )

    if upload.transcript:
        # Transcription worked, only the summary failed: the worker
        # will skip Gnani and just redo the summary.
        detail = "Queued: retrying the summary"
    else:
        # The previous Gnani job (if any) failed; start a fresh one.
        upload.gnani_job_id = None
        detail = "Queued: retrying transcription"

    upload.status = models.QUEUED
    upload.progress = 2
    upload.stage_detail = detail
    upload.error_message = None
    db.commit()

    _enqueue(db, upload)

    db.refresh(upload)
    return upload


@router.get("/{upload_id}/audio")
def get_audio(
    upload_id: uuid.UUID,
    user: User = Depends(get_current_user_header_or_query),
    db: Session = Depends(get_db),
):
    upload = _get_upload_or_404(db, upload_id, user)

    if storage.using_bucket():
        # Let the browser stream straight from the bucket.
        return RedirectResponse(storage.get_download_url(upload.storage_key))

    path = storage.get_local_path(upload.storage_key)

    if not Path(path).exists():
        raise HTTPException(status_code=404, detail="Audio file not found.")

    return FileResponse(path, filename=upload.filename)
