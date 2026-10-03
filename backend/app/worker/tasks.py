import tempfile
import time
import uuid
from pathlib import Path

from app import models
from app.database import SessionLocal
from app.models import AudioUpload
from app.services import audio, gnani, storage
from app.services.summary import SummaryError, summarize_transcript
from app.worker.celery_app import celery_app


POLL_INTERVAL_SECONDS = 10

PREPROCESS_RANGE = (5, 15)
TRANSCRIBE_RANGE = (15, 85)
SUMMARIZE_RANGE = (85, 99)


def _update(db, upload: AudioUpload, **fields) -> None:
    for key, value in fields.items():
        setattr(upload, key, value)
    db.commit()


def _scale(stage_range: tuple[int, int], fraction: float) -> int:
    low, high = stage_range
    return int(low + (high - low) * max(0.0, min(1.0, fraction)))


@celery_app.task(name="process_audio")
def process_audio(upload_id: str):
    db = SessionLocal()

    try:
        upload = db.get(AudioUpload, uuid.UUID(upload_id))

        if upload is None or upload.status == models.COMPLETED:
            return

        try:
            # summary-only retry
            if not upload.transcript:
                _transcribe(db, upload)

            _summarize(db, upload)

            _update(
                db,
                upload,
                status=models.COMPLETED,
                progress=100,
                stage_detail="Done",
                error_message=None,
            )

        except Exception as e:
            db.rollback()
            print(f"[{upload_id}] FAILED during {upload.status}: {e!r}")

            failed_stage = upload.status.lower()
            _update(
                db,
                upload,
                status=models.FAILED,
                stage_detail=f"Failed while {failed_stage}",
                error_message=_friendly_error(e),
            )

    finally:
        db.close()


def _friendly_error(e: Exception) -> str:
    if isinstance(e, (audio.AudioError, gnani.GnaniError, SummaryError, TimeoutError)):
        return str(e)
    return f"{type(e).__name__}: {e}"


def _transcribe(db, upload: AudioUpload) -> None:
    with tempfile.TemporaryDirectory() as work_dir:

        # else resume existing job
        if not upload.gnani_job_id:
            chunks = _preprocess(db, upload, work_dir)

            _update(
                db,
                upload,
                status=models.TRANSCRIBING,
                progress=TRANSCRIBE_RANGE[0],
                stage_detail=f"Uploading {len(chunks)} chunk(s) to Gnani",
            )

            job_id = gnani.create_batch_job(
                [chunk["path"] for chunk in chunks],
                upload.language_code,
            )
            # saved before start
            _update(db, upload, gnani_job_id=job_id)
            gnani.start_batch_job(job_id)

        _wait_for_gnani(db, upload)
        _collect_transcript(db, upload)


def _preprocess(db, upload: AudioUpload, work_dir: str) -> list[dict]:
    _update(
        db,
        upload,
        status=models.PREPROCESSING,
        progress=PREPROCESS_RANGE[0],
        stage_detail="Fetching audio from storage",
        error_message=None,
    )

    source_path = str(Path(work_dir) / f"source{Path(upload.filename).suffix}")
    storage.download_file(upload.storage_key, source_path)

    duration = audio.probe_duration(source_path)

    _update(
        db,
        upload,
        duration_seconds=duration,
        progress=_scale(PREPROCESS_RANGE, 0.3),
        stage_detail="Converting to 16 kHz mono and splitting into chunks",
    )

    chunks = audio.split_into_chunks(source_path, str(Path(work_dir) / "chunks"))

    _update(
        db,
        upload,
        chunk_count=len(chunks),
        progress=PREPROCESS_RANGE[1],
        stage_detail=f"Prepared {len(chunks)} chunk(s)",
    )

    return chunks


def _wait_for_gnani(db, upload: AudioUpload) -> None:
    timeout = 30 * 60 + 2 * (upload.duration_seconds or 0)
    started = time.monotonic()

    while True:
        job = gnani.get_batch_status(upload.gnani_job_id)
        status = job.get("status")
        progress = job.get("progress") or {}

        total = progress.get("total_files") or upload.chunk_count or 1
        done = progress.get("completed_files") or 0

        if status == gnani.JOB_SUCCESS:
            return

        # never started
        if status == "CREATED":
            gnani.start_batch_job(upload.gnani_job_id)

        if status in gnani.JOB_FAILED_STATUSES:
            reason = job.get("cancel_reason") or _file_errors(upload.gnani_job_id)
            raise gnani.GnaniError(
                f"Gnani job ended with status {status}"
                + (f": {reason}" if reason else "")
            )

        if time.monotonic() - started > timeout:
            raise TimeoutError(
                f"Gnani did not finish within {int(timeout // 60)} minutes "
                f"(last status: {status})."
            )

        label = {
            "CREATED": "Job created",
            "STARTING": "Job starting",
            "QUEUED": "Waiting in Gnani's queue",
            "IN_PROGRESS": "Transcribing",
        }.get(status, status)

        _update(
            db,
            upload,
            progress=_scale(TRANSCRIBE_RANGE, done / total),
            stage_detail=f"{label}: {done} of {total} chunk(s) done",
        )

        time.sleep(POLL_INTERVAL_SECONDS)


def _file_errors(job_id: str) -> str:
    try:
        files = gnani.get_job_files(job_id)
    except Exception:
        return ""

    errors = {
        f.get("error_message") for f in files if f.get("error_message")
    }
    return "; ".join(sorted(errors))


def _collect_transcript(db, upload: AudioUpload) -> None:
    _update(db, upload, stage_detail="Downloading transcripts from Gnani")

    files = gnani.get_job_files(upload.gnani_job_id)

    # restore chunk order
    files.sort(key=lambda f: Path(f.get("original_path") or "").name)

    segments = []
    texts = []
    offset = 0.0

    for file_info in files:
        if file_info.get("status") != "COMPLETED":
            raise gnani.GnaniError(
                f"Chunk {file_info.get('original_path')} failed: "
                f"{file_info.get('error_message') or file_info.get('status')}"
            )

        result = gnani.download_transcript(file_info["transcript_url"])

        for segment in result.get("segments") or []:
            text = (segment.get("text") or "").strip()
            if not text:
                continue
            # chunk time -> file time
            segments.append({
                "start": round(offset + float(segment.get("start_time") or 0), 2),
                "end": round(offset + float(segment.get("end_time") or 0), 2),
                "text": text,
            })

        texts.append((result.get("full_transcript") or "").strip())

        chunk_duration = (
            result.get("duration_seconds")
            or file_info.get("duration_seconds")
            or audio.CHUNK_SECONDS
        )
        offset += float(chunk_duration)

    _update(
        db,
        upload,
        transcript=" ".join(t for t in texts if t),
        segments=segments,
        progress=TRANSCRIBE_RANGE[1],
        stage_detail="Transcript ready",
    )


def _summarize(db, upload: AudioUpload) -> None:
    _update(
        db,
        upload,
        status=models.SUMMARIZING,
        progress=SUMMARIZE_RANGE[0],
        stage_detail="Generating summary",
        error_message=None,
    )

    def on_progress(index: int, total: int) -> None:
        _update(
            db,
            upload,
            progress=_scale(SUMMARIZE_RANGE, index / total),
            stage_detail=f"Summarising part {index + 1} of {total}",
        )

    summary = summarize_transcript(upload.transcript, on_progress)

    _update(db, upload, summary=summary)
