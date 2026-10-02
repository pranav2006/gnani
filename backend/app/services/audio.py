"""
Audio inspection and preprocessing with ffmpeg / ffprobe.

Why we preprocess before sending to Gnani:
  - Gnani's batch API accepts at most 10 MB per uploaded file. A 1 hour
    WAV is ~600 MB, so we cannot send the original as-is.
  - Gnani resamples everything to 16 kHz mono internally, so converting
    to 16 kHz mono ourselves loses nothing the ASR would have used.
  - At 16 kHz mono, 32 kbps MP3 a 10 minute chunk is ~2.4 MB, safely
    under the limit. All chunks go into ONE batch job (max 100 files),
    which Gnani can process in parallel.
  - Running ffmpeg over the whole file also catches corrupted audio
    early, with a clear error, instead of a vague failure at Gnani.
"""

import json
import subprocess
from pathlib import Path


CHUNK_SECONDS = 600
MAX_CHUNKS = 100  # Gnani: max 100 files per batch job.


class AudioError(Exception):
    """The file is not usable audio (corrupted, empty, not audio...)."""


def probe_duration(path: str) -> float:
    """Return duration in seconds, or raise AudioError if unreadable."""

    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v", "error",
                "-select_streams", "a:0",
                "-show_entries", "format=duration:stream=codec_type",
                "-of", "json",
                path,
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )
    except subprocess.TimeoutExpired:
        raise AudioError("Timed out while reading the audio file.")

    if result.returncode != 0:
        raise AudioError(
            "Could not read this file as audio. It may be corrupted "
            "or in an unsupported format."
        )

    info = json.loads(result.stdout or "{}")

    if not info.get("streams"):
        raise AudioError("This file does not contain an audio track.")

    try:
        duration = float(info["format"]["duration"])
    except (KeyError, TypeError, ValueError):
        raise AudioError("Could not determine the audio duration.")

    if duration < 0.5:
        raise AudioError("The audio is too short to transcribe.")

    return duration


def split_into_chunks(
    source_path: str,
    output_dir: str,
) -> list[dict]:
    """
    Convert to 16 kHz mono MP3 and cut into CHUNK_SECONDS pieces in a
    single ffmpeg pass.

    Returns [{"path", "name", "offset", "duration"}, ...] in order.
    "offset" is where the chunk starts in the original audio; we need it
    to turn chunk-relative timestamps back into file-relative ones.
    """

    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    pattern = str(out_dir / "chunk_%03d.mp3")

    result = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel", "error",
            "-y",
            "-i", source_path,
            "-vn",                 # drop any video / cover art
            "-ac", "1",            # mono
            "-ar", "16000",        # 16 kHz
            "-c:a", "libmp3lame",
            "-b:a", "32k",
            "-f", "segment",
            "-segment_time", str(CHUNK_SECONDS),
            "-reset_timestamps", "1",
            pattern,
        ],
        capture_output=True,
        text=True,
        timeout=60 * 30,
    )

    if result.returncode != 0:
        raise AudioError(
            "ffmpeg could not decode the audio (the file may be "
            f"corrupted): {result.stderr.strip()[-300:]}"
        )

    chunk_paths = sorted(out_dir.glob("chunk_*.mp3"))

    if not chunk_paths:
        raise AudioError("No audio could be extracted from the file.")

    if len(chunk_paths) > MAX_CHUNKS:
        raise AudioError(
            f"Audio is too long ({len(chunk_paths)} chunks, max {MAX_CHUNKS})."
        )

    chunks = []
    offset = 0.0

    for chunk_path in chunk_paths:
        duration = probe_duration(str(chunk_path))

        chunks.append({
            "path": str(chunk_path),
            "name": chunk_path.name,
            "offset": offset,
            "duration": duration,
        })

        # Use the real measured duration, not CHUNK_SECONDS, so
        # timestamps stay accurate even if ffmpeg cut slightly off.
        offset += duration

    return chunks
