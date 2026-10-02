"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import Waveform from "./Waveform";
import { AlertIcon, SparklesIcon, UploadIcon } from "./Icons";
import { ALLOWED_EXTENSIONS, ApiError, LANGUAGES, MAX_UPLOAD_MB, formatBytes, formatDuration, uploadFile } from "@/lib/api";

type Phase =
  | { kind: "idle" }
  | { kind: "uploading"; fraction: number; bytesPerSecond: number }
  | { kind: "processing" } // bytes sent, server is validating + saving to bucket
  | { kind: "error"; message: string; limitReached?: boolean };

function validate(file: File): string | null {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `Unsupported file type "${ext}". Use one of: ${ALLOWED_EXTENSIONS.join(", ")}`;
  }
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return `File is larger than ${MAX_UPLOAD_MB} MB.`;
  return null;
}

export default function UploadForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState("en-IN");
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const busy = phase.kind === "uploading" || phase.kind === "processing";

  function pick(selected: File | undefined) {
    if (!selected || busy) return;
    const problem = validate(selected);
    setFile(problem ? null : selected);
    setPhase(problem ? { kind: "error", message: problem } : { kind: "idle" });
  }

  async function submit() {
    if (!file) return;
    const startedAt = performance.now();
    setPhase({ kind: "uploading", fraction: 0, bytesPerSecond: 0 });

    const { promise, abort } = uploadFile(file, language, (fraction) => {
      if (fraction >= 1) {
        setPhase({ kind: "processing" });
        return;
      }
      const seconds = (performance.now() - startedAt) / 1000;
      setPhase({ kind: "uploading", fraction, bytesPerSecond: seconds > 0 ? (fraction * file.size) / seconds : 0 });
    });
    abortRef.current = abort;

    try {
      const upload = await promise;
      refreshUser(); // update the "x / 10 uploads" counter
      router.push(`/uploads/${upload.id}`);
    } catch (e) {
      const limitReached = e instanceof ApiError && e.status === 402;
      if (limitReached) refreshUser();
      setPhase({ kind: "error", message: (e as Error).message, limitReached });
    } finally {
      abortRef.current = null;
    }
  }

  const openPicker = () => !busy && inputRef.current?.click();

  const limit = user?.upload_limit ?? null;
  const used = user?.uploads_used ?? 0;

  if (limit != null && used >= limit && !busy) return <LimitReached limit={limit} />;

  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm sm:p-5">
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_EXTENSIONS.join(",") + ",audio/*"}
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {busy && file ? (
        <UploadingCard file={file} phase={phase} onCancel={() => abortRef.current?.()} />
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={openPicker}
          onKeyDown={(e) => e.key === "Enter" && openPicker()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files[0]);
          }}
          className={`group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition-all duration-200 ${
            compact ? "px-4 py-6" : "px-6 py-10"
          } ${
            dragging
              ? "scale-[1.01] border-brand-500 bg-brand-50"
              : "border-neutral-200 hover:border-brand-200 hover:bg-brand-50/40"
          }`}
        >
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 transition group-hover:bg-brand-100 ${
              dragging ? "animate-float" : ""
            }`}
          >
            <UploadIcon className="h-6 w-6" />
          </span>
          {file ? (
            <div className="mt-3 animate-fade-up">
              <p className="max-w-full truncate font-semibold">{file.name}</p>
              <p className="mt-0.5 text-xs text-neutral-500">{formatBytes(file.size)} · click to change</p>
            </div>
          ) : (
            <>
              <p className="mt-3 font-semibold">{dragging ? "Release to add the file" : "Drop audio file or click to browse"}</p>
              <p className="mt-0.5 text-xs text-neutral-500">MP3, WAV, M4A, FLAC… up to {MAX_UPLOAD_MB} MB, any length</p>
            </>
          )}
        </div>
      )}

      {!busy && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="font-mono text-[11px] uppercase tracking-wider text-neutral-500" htmlFor="language">
            Language
          </label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          >
            {Object.entries(LANGUAGES).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
          <button
            onClick={submit}
            disabled={!file}
            className="ml-auto rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-brand-600/25 transition hover:-translate-y-0.5 hover:bg-brand-700 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400 disabled:shadow-none"
          >
            Transcribe
          </button>
        </div>
      )}

      {phase.kind === "error" && (
        <div className="mt-4 flex animate-fade-up items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {phase.message}{" "}
            {phase.limitReached && (
              <Link href="/pricing" className="font-semibold underline">
                See plans
              </Link>
            )}
          </span>
        </div>
      )}

      {limit != null && !busy && (
        <div className="mt-4 border-t border-neutral-100 pt-3">
          <div className="flex justify-between font-mono text-[11px] text-neutral-500">
            <span>Free plan</span>
            <span>
              {used} / {limit} uploads used
            </span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-neutral-100">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${used >= limit - 2 ? "bg-amber-500" : "bg-brand-600"}`}
              style={{ width: `${Math.min(100, (used / limit) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function UploadingCard({ file, phase, onCancel }: { file: File; phase: Phase; onCancel: () => void }) {
  const uploading = phase.kind === "uploading";
  const fraction = uploading ? phase.fraction : 1;
  const speed = uploading ? phase.bytesPerSecond : 0;
  const remaining = uploading && speed > 0 ? ((1 - fraction) * file.size) / speed : null;

  return (
    <div className="animate-fade-up rounded-xl bg-linear-to-br from-brand-50 to-white p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm">
          {uploading ? <UploadIcon className="h-5 w-5 animate-float" /> : <Waveform className="h-5" bars={5} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{file.name}</p>
          <p className="font-mono text-[11px] text-neutral-500">
            {uploading ? (
              <>
                {formatBytes(fraction * file.size)} / {formatBytes(file.size)}
                {speed > 0 && ` · ${formatBytes(speed)}/s`}
                {remaining != null && ` · ${formatDuration(remaining)} left`}
              </>
            ) : (
              <span className="loading-dots">Checking the audio and saving it</span>
            )}
          </p>
        </div>
        <span className="font-mono text-sm font-semibold text-brand-600 tabular-nums">{Math.round(fraction * 100)}%</span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-100">
        <div className="bar-shimmer h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.max(3, fraction * 100)}%` }} />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
        <span>{uploading ? "Uploading to server" : "Almost there. Opening the studio next."}</span>
        {uploading && (
          <button onClick={onCancel} className="rounded-md px-2 py-1 font-medium text-neutral-600 transition hover:bg-white hover:text-red-600">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function LimitReached({ limit }: { limit: number }) {
  return (
    <div className="animate-fade-up rounded-2xl border border-brand-200 bg-linear-to-br from-brand-50 to-white p-6 text-center shadow-sm">
      <span className="mx-auto flex h-12 w-12 animate-float items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30">
        <SparklesIcon className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-lg font-bold">You&apos;ve used all {limit} free uploads</h2>
      <p className="mx-auto mt-1 max-w-xs text-sm text-neutral-600">
        Your past transcripts are still here. Upgrade to Pro to keep uploading without limits.
      </p>
      <Link
        href="/pricing"
        className="mt-5 inline-block rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-600/25 transition hover:-translate-y-0.5 hover:bg-brand-700"
      >
        See plans
      </Link>
    </div>
  );
}
