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
    task_ignore_result=True,
    # crash-safe redelivery
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    # allow long jobs
    broker_transport_options={"visibility_timeout": 6 * 60 * 60},
    broker_connection_retry_on_startup=True,
)
