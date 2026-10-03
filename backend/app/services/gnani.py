import json
import os
import time

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from app import config


GNANI_BASE_URL = "https://api.vachana.ai"

JOB_SUCCESS = "COMPLETED"
JOB_FAILED_STATUSES = {
    "FAILED",
    "START_FAILED",
    "PARTIAL_FAILURE",
    "CANCELLED",
}


class GnaniError(Exception):
    pass


def _build_session() -> requests.Session:
    # POSTs never auto-retried
    retry = Retry(
        total=4,
        backoff_factor=2,
        status_forcelist=[429, 500, 502, 503, 504],
        respect_retry_after_header=True,
        raise_on_status=False,
    )

    session = requests.Session()
    session.mount("https://", HTTPAdapter(max_retries=retry))
    return session


_session = _build_session()


def get_headers():
    if not config.GNANI_API_KEY:
        raise GnaniError("GNANI_API_KEY is not configured on the server.")

    return {"X-API-Key-ID": config.GNANI_API_KEY}


def _check(response: requests.Response, action: str) -> dict:
    if not response.ok:
        raise GnaniError(
            f"Gnani {action} failed ({response.status_code}): "
            f"{response.text[:300]}"
        )

    return response.json()


def create_batch_job(
    audio_paths: list[str],
    language_code: str = "en-IN",
) -> str:

    url = f"{GNANI_BASE_URL}/stt/v3/batch/jobs"

    job_config = {
        "model": "gnani-prisma-v2.5",
        "language_code": language_code,
        "mode": "transcribe",
        "with_diarization": False,
        "is_multi_channel": False,
    }

    open_files = [open(path, "rb") for path in audio_paths]

    try:
        multipart_payload = [
            ("config", (None, json.dumps(job_config), "application/json")),
        ]

        for path, handle in zip(audio_paths, open_files):
            multipart_payload.append(
                ("files", (os.path.basename(path), handle, "audio/mpeg"))
            )

        response = _session.post(
            url,
            headers=get_headers(),
            files=multipart_payload,
            timeout=300,
        )
    finally:
        for handle in open_files:
            handle.close()

    body = _check(response, "create job")
    job_id = body.get("job_id") or body.get("data", {}).get("job_id")

    if not job_id:
        raise GnaniError(f"Could not parse job_id from Gnani response: {body}")

    return job_id


def start_batch_job(job_id: str, attempts: int = 6) -> dict:
    url = f"{GNANI_BASE_URL}/stt/v3/batch/jobs/{job_id}/start"

    # start is safe to retry
    for attempt in range(attempts):
        response = _session.post(
            url,
            headers=get_headers(),
            timeout=30,
        )

        retryable = response.status_code == 429 or response.status_code >= 500

        if not retryable or attempt == attempts - 1:
            return _check(response, "start job")

        retry_after = response.headers.get("retry-after")
        delay = float(retry_after) if retry_after else 2 ** (attempt + 1)
        time.sleep(min(delay, 60))


def get_batch_status(job_id: str) -> dict:

    url = f"{GNANI_BASE_URL}/stt/v3/batch/jobs/{job_id}"

    response = _session.get(
        url,
        headers=get_headers(),
        timeout=30,
    )

    return _check(response, "get job status")


def get_job_files(job_id: str) -> list[dict]:

    url = f"{GNANI_BASE_URL}/stt/v3/batch/jobs/{job_id}/files"
    files = []
    cursor = None

    while True:
        params = {"limit": 100}

        if cursor:
            params["cursor"] = cursor

        response = _session.get(
            url,
            headers=get_headers(),
            params=params,
            timeout=30,
        )

        body = _check(response, "list job files")
        files.extend(body.get("data") or body.get("files") or [])

        pagination = body.get("pagination") or {}
        cursor = pagination.get("next_cursor")

        if not pagination.get("has_more") or not cursor:
            return files


def download_transcript(transcript_url: str) -> dict:

    response = _session.get(transcript_url, timeout=60)
    return _check(response, "download transcript")
