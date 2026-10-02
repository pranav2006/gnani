"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StatusBadge from "./StatusBadge";
import Waveform from "./Waveform";
import { AlertIcon } from "./Icons";
import {
  LANGUAGES,
  type UploadSummary,
  formatDuration,
  isTerminal,
  listUploads,
  parseServerDate,
} from "@/lib/api";

function timeAgo(date: Date) {
  const seconds = (Date.now() - date.getTime()) / 1000;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return date.toLocaleDateString();
}

export default function UploadList() {
  const [uploads, setUploads] = useState<UploadSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function load() {
      try {
        const data = await listUploads();
        if (cancelled) return;
        setUploads(data);
        setError(null);
        // Keep refreshing only while something is still in progress.
        if (data.some((u) => !isTerminal(u.status))) timer = setTimeout(load, 4000);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
        timer = setTimeout(load, 8000);
      }
    }

    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <section className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-brand-600">Library</p>
          <h2 className="text-lg font-bold">Past uploads</h2>
        </div>
        {uploads && <span className="font-mono text-xs text-neutral-400">{uploads.length} file(s)</span>}
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertIcon className="h-4 w-4 shrink-0" />
          <span>
            {error} <span className="loading-dots">Retrying</span>
          </span>
        </div>
      )}

      {uploads === null && !error && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-neutral-100 p-3">
              <div className="skeleton h-10 w-10 rounded-lg!" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3 w-2/3" />
                <div className="skeleton h-2.5 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {uploads?.length === 0 && (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-neutral-200 px-6 py-12 text-center">
          <Waveform active={false} className="h-8" color="bg-neutral-300" />
          <p className="mt-3 font-semibold text-neutral-700">No recordings yet</p>
          <p className="mt-1 text-sm text-neutral-500">Upload one and its transcript and summary will show up here.</p>
        </div>
      )}

      {uploads && uploads.length > 0 && (
        <ul className="space-y-2">
          {uploads.map((u, i) => {
            const running = !isTerminal(u.status);
            return (
              <li key={u.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
                <Link
                  href={`/uploads/${u.id}`}
                  className="group flex items-center gap-3 rounded-xl border border-neutral-100 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md hover:shadow-brand-600/5"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      u.status === "FAILED" ? "bg-red-50" : "bg-brand-50"
                    }`}
                  >
                    {u.status === "FAILED" ? (
                      <AlertIcon className="h-5 w-5 text-red-500" />
                    ) : (
                      <Waveform active={running} bars={5} className="h-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold group-hover:text-brand-700">{u.filename}</span>
                      <span className="ml-auto">
                        <StatusBadge status={u.status} />
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[11px] text-neutral-500">
                      <span>{formatDuration(u.duration_seconds)}</span>
                      <span>{LANGUAGES[u.language_code] ?? u.language_code}</span>
                      <span>{timeAgo(parseServerDate(u.created_at))}</span>
                    </div>
                    {running && (
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-brand-50">
                        <div className="bar-shimmer h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(3, u.progress)}%` }} />
                      </div>
                    )}
                    {u.status === "FAILED" && u.error_message && (
                      <p className="mt-1 truncate text-xs text-red-600">{u.error_message}</p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
