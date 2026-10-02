from celery import Celery

from app.config import REDIS_URL


celery_app = Celery(
    "audio_notes",
    broker=REDIS_URL,
    include=["app.worker.tasks"],
)


celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    # We store results in Postgres ourselves, so no Celery result backend.
    task_ignore_result=True,
    # Acknowledge the message only after the task finishes. If the worker
    # crashes mid-job, Redis hands the task to another worker instead of
    # losing it. The task is written to be safe to run twice.
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    # One long task at a time per worker process; don't hoard messages.
    worker_prefetch_multiplier=1,
    # With acks_late, Redis re-delivers any task not acked within the
    # visibility timeout (default 1 hour). Long audio can take longer
    # than that, so raise it to avoid running the same job twice.
    broker_transport_options={"visibility_timeout": 6 * 60 * 60},
    broker_connection_retry_on_startup=True,
)
