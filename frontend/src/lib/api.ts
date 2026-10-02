export const GITHUB_URL =
  process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com/Pranav-iitbhu/gnani-audio-notes";

export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

export type UploadStatus =
  | "QUEUED"
  | "PREPROCESSING"
  | "TRANSCRIBING"
  | "SUMMARIZING"
  | "COMPLETED"
  | "FAILED";

export interface UploadSummary {
  id: string;
  filename: string;
  status: UploadStatus;
  progress: number;
  stage_detail: string | null;
  duration_seconds: number | null;
  language_code: string;
  error_message: string | null;
  created_at: string;
}

export interface Segment {
  start: number;
  end: number;
  text: string;
}

export interface UploadDetail extends UploadSummary {
  size_bytes: number | null;
  chunk_count: number | null;
  transcript: string | null;
  segments: Segment[] | null;
  summary: string | null;
  updated_at: string;
}

export const LANGUAGES: Record<string, string> = {
  "en-IN": "English (India)",
  "hi-IN": "Hindi",
  "bn-IN": "Bengali",
  "kn-IN": "Kannada",
  "ml-IN": "Malayalam",
  "mr-IN": "Marathi",
  "ta-IN": "Tamil",
  "te-IN": "Telugu",
};

export const ALLOWED_EXTENSIONS = [
  ".wav", ".mp3", ".m4a", ".aac", ".ogg", ".opus",
  ".flac", ".webm", ".mp4", ".amr",
];

export const MAX_UPLOAD_MB = 500;

export function isTerminal(status: UploadStatus) {
  return status === "COMPLETED" || status === "FAILED";
}

// FastAPI errors look like {"detail": "..."} (or a list for validation).
async function errorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) return body.detail.map((d: { msg: string }) => d.msg).join(", ");
  } catch {
    // not JSON
  }
  return `Request failed with status ${response.status}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { cache: "no-store", ...init });
  } catch {
    throw new Error("Cannot reach the server. Check your connection.");
  }
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json();
}

export const listUploads = () => request<UploadSummary[]>("/uploads/");

export const getUpload = (id: string) => request<UploadDetail>(`/uploads/${id}`);

export const retryUpload = (id: string) =>
  request<UploadDetail>(`/uploads/${id}/retry`, { method: "POST" });

export const audioUrl = (id: string) => `${API_URL}/uploads/${id}/audio`;

/**
 * Upload with XMLHttpRequest because fetch() has no upload progress
 * events. onProgress gets 0..1 for the bytes sent to our API.
 */
export function uploadFile(
  file: File,
  languageCode: string,
  onProgress: (fraction: number) => void,
): { promise: Promise<UploadDetail>; abort: () => void } {
  const xhr = new XMLHttpRequest();

  const promise = new Promise<UploadDetail>((resolve, reject) => {
    xhr.open("POST", `${API_URL}/uploads/`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };

    xhr.onload = () => {
      let body: { detail?: unknown } | null = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // not JSON
      }
      if (xhr.status >= 200 && xhr.status < 300 && body) {
        resolve(body as UploadDetail);
      } else {
        const detail = typeof body?.detail === "string" ? body.detail : null;
        reject(new Error(detail ?? `Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error: the upload could not reach the server."));
    xhr.ontimeout = () => reject(new Error("The upload timed out."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));

    const form = new FormData();
    form.append("file", file);
    form.append("language_code", languageCode);
    xhr.send(form);
  });

  return { promise, abort: () => xhr.abort() };
}

export function formatDuration(seconds: number | null | undefined) {
  if (seconds == null) return "—";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatBytes(bytes: number | null | undefined) {
  if (bytes == null) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Backend stores naive UTC datetimes; tell the browser they are UTC.
export function parseServerDate(value: string) {
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
}
