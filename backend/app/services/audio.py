import json
import subprocess
from pathlib import Path


CHUNK_SECONDS = 600
MAX_CHUNKS = 100


class AudioError(Exception):
    """Unusable audio."""


def probe_duration(path: str) -> float:

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
            "-vn",
            "-ac", "1",
            "-ar", "16000",
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

        # measured, not assumed
        offset += duration

    return chunks
