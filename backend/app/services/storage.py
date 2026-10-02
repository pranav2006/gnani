"""
Where the original audio files live.

Two backends behind the same three functions:
  - S3-compatible bucket (production) when S3_BUCKET is configured
  - a local folder (development) otherwise

The API and the worker run as separate processes (separate containers in
production), so they cannot share a local disk. That's why production
must use the bucket: the API uploads, the worker downloads.
"""

import shutil
from functools import lru_cache
from pathlib import Path

from app import config


def using_bucket() -> bool:
    return bool(config.S3_BUCKET)


@lru_cache
def _s3_client():
    import boto3

    return boto3.client(
        "s3",
        endpoint_url=config.S3_ENDPOINT_URL,
        region_name=config.S3_REGION,
        aws_access_key_id=config.S3_ACCESS_KEY_ID,
        aws_secret_access_key=config.S3_SECRET_ACCESS_KEY,
    )


def save_file(
    source_path: str,
    storage_key: str,
) -> None:

    if using_bucket():
        # upload_file does multipart upload automatically for big files.
        _s3_client().upload_file(
            source_path,
            config.S3_BUCKET,
            storage_key,
        )
        return

    destination = Path(config.LOCAL_STORAGE_DIR) / storage_key

    destination.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    shutil.copy2(
        source_path,
        destination,
    )


def download_file(
    storage_key: str,
    destination_path: str,
) -> None:

    if using_bucket():
        _s3_client().download_file(
            config.S3_BUCKET,
            storage_key,
            destination_path,
        )
        return

    source = Path(config.LOCAL_STORAGE_DIR) / storage_key

    if not source.exists():
        raise FileNotFoundError(
            f"Stored file is missing: {storage_key}"
        )

    shutil.copy2(source, destination_path)


def get_local_path(
    storage_key: str,
) -> str:
    return str(Path(config.LOCAL_STORAGE_DIR) / storage_key)


def get_download_url(
    storage_key: str,
    expires_in: int = 3600,
) -> str:
    """Temporary URL the browser can use to play the original audio."""

    return _s3_client().generate_presigned_url(
        "get_object",
        Params={
            "Bucket": config.S3_BUCKET,
            "Key": storage_key,
        },
        ExpiresIn=expires_in,
    )
