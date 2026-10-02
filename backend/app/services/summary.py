"""
Summarisation with an LLM on Groq (OpenAI-compatible chat API).

Long transcripts: Groq's free tier limits tokens per minute, and very
long inputs make summaries worse anyway. So we use map-reduce:
  - short transcript  -> one call
  - long transcript   -> summarise each piece ("map"), then summarise
                         the partial summaries into one ("reduce").
"""

import time

import requests

from app import config


GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# ~4 characters per token, so ~12k chars is ~3k tokens per request,
# comfortably inside free tier per-minute limits.
MAX_CHARS_PER_CALL = 12000

SYSTEM_PROMPT = (
    "You summarise transcripts of audio recordings. The transcript comes "
    "from automatic speech recognition and may contain recognition "
    "errors; infer the intended meaning where it is obvious. "
    "Write in the same language as the transcript."
)

FINAL_INSTRUCTIONS = (
    "Write a summary of this recording in Markdown with:\n"
    "1. A one or two sentence overview.\n"
    "2. A '## Key points' section with bullet points.\n"
    "3. A '## Action items' section ONLY if the speakers mention tasks, "
    "decisions or follow-ups.\n"
    "Be concise and do not invent details that are not in the text."
)

PARTIAL_INSTRUCTIONS = (
    "This is one part of a longer recording. Summarise this part in "
    "bullet points, keeping every important fact, name, number, "
    "decision and task."
)


class SummaryError(Exception):
    pass


def _chat(user_content: str, attempts: int = 4) -> str:
    if not config.GROQ_API_KEY:
        raise SummaryError("GROQ_API_KEY is not configured on the server.")

    for attempt in range(attempts):
        try:
            response = requests.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {config.GROQ_API_KEY}"},
                json={
                    "model": config.GROQ_MODEL,
                    "temperature": 0.3,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_content},
                    ],
                },
                timeout=120,
            )
        except requests.RequestException as e:
            if attempt == attempts - 1:
                raise SummaryError(f"Could not reach the LLM API: {e}")
            time.sleep(2 ** attempt)
            continue

        # Rate limited or server hiccup: wait and try again.
        if response.status_code == 429 or response.status_code >= 500:
            if attempt == attempts - 1:
                break
            retry_after = response.headers.get("retry-after")
            delay = float(retry_after) if retry_after else 2 ** (attempt + 1)
            time.sleep(min(delay, 60))
            continue

        if not response.ok:
            raise SummaryError(
                f"LLM API error ({response.status_code}): {response.text[:300]}"
            )

        return response.json()["choices"][0]["message"]["content"].strip()

    raise SummaryError(
        "The LLM API is rate limiting or unavailable. Please retry later."
    )


def _split_text(text: str, max_chars: int) -> list[str]:
    """Split on sentence-ish boundaries so pieces stay readable."""

    pieces = []
    current = ""

    for sentence in text.replace("\n", " ").split(". "):
        if current and len(current) + len(sentence) > max_chars:
            pieces.append(current)
            current = ""
        current += sentence + ". "

    if current.strip():
        pieces.append(current)

    return pieces


def summarize_transcript(transcript: str, on_progress=None) -> str:
    transcript = transcript.strip()

    if not transcript:
        return "The recording did not contain any recognisable speech."

    if len(transcript) <= MAX_CHARS_PER_CALL:
        return _chat(f"{FINAL_INSTRUCTIONS}\n\nTranscript:\n{transcript}")

    # Map
    pieces = _split_text(transcript, MAX_CHARS_PER_CALL)
    partial_summaries = []

    for index, piece in enumerate(pieces):
        if on_progress:
            on_progress(index, len(pieces))

        partial_summaries.append(
            _chat(f"{PARTIAL_INSTRUCTIONS}\n\nTranscript part:\n{piece}")
        )

    # Reduce
    combined = "\n\n".join(
        f"Part {i + 1}:\n{s}" for i, s in enumerate(partial_summaries)
    )

    return _chat(
        f"{FINAL_INSTRUCTIONS}\n\nBelow are summaries of consecutive parts "
        f"of one recording. Combine them into a single summary.\n\n{combined}"
    )
