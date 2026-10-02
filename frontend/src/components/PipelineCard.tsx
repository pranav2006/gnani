"use client";

import { useEffect, useState } from "react";
import { AlertIcon, CheckIcon, RetryIcon } from "./Icons";
import { type UploadDetail, formatDuration, isTerminal, parseServerDate } from "@/lib/api";

// These ranges mirror PREPROCESS/TRANSCRIBE/SUMMARIZE_RANGE in the
// worker (backend/app/worker/tasks.py), so one overall 0-100 progress
// number can be shown as three per-stage bars.
const STAGES = [
  { key: "PREPROCESSING", label: "Prepare", range: [2, 15] },
  { key: "TRANSCRIBING", label: "Transcribe", range: [15, 85] },
  { key: "SUMMARIZING", label: "Summarise", range: [85, 100] },
] as const;

type StageState = "waiting" | "active" | "done" | "failed";

function stageIndex(upload: UploadDetail): number {
  if (upload.status === "COMPLETED") return STAGES.length;
  if (upload.status === "QUEUED") return 0;
  if (upload.status === "FAILED") {
    // stage_detail is "Failed while <status>"; a saved transcript means
    // only the summary step failed.
    if (upload.transcript) return 2;
    const found = STAGES.findIndex((s) => upload.stage_detail?.toUpperCase().includes(s.key));
    return found === -1 ? 0 : found;
  }
  return STAGES.findIndex((s) => s.key === upload.status);
}

function useElapsed(since: string, running: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  return Math.max(0, (now - parseServerDate(since).getTime()) / 1000);
}

export default function PipelineCard({
  upload,
  onRetry,
  retrying,
  retryError,
}: {
  upload: UploadDetail;
  onRetry: () => void;
  retrying: boolean;
  retryError: string | null;
}) {
  const running = !isTerminal(upload.status);
  const failed = upload.status === "FAILED";
  const current = stageIndex(upload);
  const elapsed = useElapsed(upload.created_at, running);

  return (
    <section className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">Processing pipeline</p>
        {running && <span className="font-mono text-[11px] text-neutral-400 tabular-nums">{formatDuration(elapsed)} elapsed</span>}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {STAGES.map((stage, i) => {
          const state: StageState =
            i < current ? "done" : i === current ? (failed ? "failed" : running ? "active" : "waiting") : "waiting";
          const [low, high] = stage.range;
          const fill =
            state === "done" ? 100 : state === "active" ? ((upload.progress - low) / (high - low)) * 100 : state === "failed" ? 100 : 0;

          return (
            <div
              key={stage.key}
              className={`rounded-xl border p-2.5 transition-colors duration-300 ${
                state === "active"
                  ? "border-brand-200 bg-brand-50/60"
                  : state === "failed"
                    ? "border-red-200 bg-red-50"
                    : "border-neutral-100 bg-neutral-50/60"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={`truncate text-sm font-semibold ${
                    state === "waiting" ? "text-neutral-400" : state === "failed" ? "text-red-700" : state === "active" ? "text-brand-700" : "text-ink"
                  }`}
                >
                  {stage.label}
                </span>
                {state === "done" && (
                  <span className="flex h-4 w-4 animate-pop items-center justify-center rounded-full bg-emerald-500 text-white">
                    <CheckIcon className="h-2.5 w-2.5" />
                  </span>
                )}
                {state === "active" && (
                  <span className="font-mono text-[10px] font-semibold text-brand-600 tabular-nums">{Math.round(Math.max(0, fill))}%</span>
                )}
                {state === "failed" && <AlertIcon className="h-3.5 w-3.5 text-red-500" />}
                {state === "waiting" && <span className="font-mono text-[10px] text-neutral-400">{upload.status === "QUEUED" && i === 0 ? "Queue" : "—"}</span>}
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-neutral-200/70">
                <div
                  className={`h-full rounded-full transition-[width] duration-700 ${
                    state === "done" ? "bg-emerald-500" : state === "failed" ? "bg-red-400" : "bar-shimmer"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(state === "active" ? 4 : 0, fill))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {running && (
        <p key={upload.stage_detail} className="mt-3 animate-fade-up text-sm text-neutral-600">
          <span className="loading-dots">{upload.stage_detail ?? "Working"}</span>
        </p>
      )}
      {upload.status === "QUEUED" && elapsed > 60 && (
        <p className="mt-1 text-xs text-amber-700">
          Still waiting for a worker. It may be busy with other files or restarting.
        </p>
      )}
      {upload.status === "COMPLETED" && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-emerald-700">
          <CheckIcon className="h-4 w-4" /> Transcript and summary ready
        </p>
      )}

      {failed && (
        <div className="mt-4 animate-fade-up rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
            <AlertIcon className="h-4 w-4" />
            {upload.transcript ? "Transcript is ready, but the summary failed" : "Processing failed"}
          </p>
          <p className="mt-1 break-words text-xs leading-relaxed text-red-700">{upload.error_message ?? "Unknown error."}</p>
          <button
            onClick={onRetry}
            disabled={retrying}
            className="mt-3 flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            <RetryIcon className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
            {retrying ? "Retrying" : upload.transcript ? "Retry summary" : "Retry"}
          </button>
          {retryError && <p className="mt-2 text-xs text-red-700">{retryError}</p>}
        </div>
      )}
    </section>
  );
}
