"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Markdown from "./Markdown";
import Waveform from "./Waveform";
import { CheckIcon, CopyIcon, DocIcon, SearchIcon, SparklesIcon } from "./Icons";
import { type Segment, type UploadDetail, formatDuration } from "@/lib/api";

type Tab = "transcript" | "summary";

// ~30 s passages
function groupSegments(segments: Segment[]) {
  const blocks: { start: number; end: number; items: { segment: Segment; index: number }[] }[] = [];
  segments.forEach((segment, index) => {
    const last = blocks[blocks.length - 1];
    if (last && segment.start - last.start < 30) {
      last.items.push({ segment, index });
      last.end = segment.end;
    } else {
      blocks.push({ start: segment.start, end: segment.end, items: [{ segment, index }] });
    }
  });
  return blocks;
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlight(text: string, query: string): ReactNode {
  if (!query) return text;
  return text.split(new RegExp(`(${escapeRegExp(query)})`, "gi")).map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="rounded bg-amber-200/80 px-0.5 text-ink">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 transition hover:border-brand-200 hover:text-brand-700"
    >
      {copied ? <CheckIcon className="h-3.5 w-3.5 animate-pop text-emerald-600" /> : <CopyIcon className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function SkeletonLines({ count = 4 }: { count?: number }) {
  const widths = ["w-full", "w-11/12", "w-4/5", "w-full", "w-2/3", "w-5/6"];
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`skeleton h-3 ${widths[i % widths.length]}`} />
      ))}
    </div>
  );
}

export default function ResultsPanel({
  upload,
  currentTime,
  onSeek,
}: {
  upload: UploadDetail;
  currentTime: number;
  onSeek: (seconds: number) => void;
}) {
  const [tab, setTab] = useState<Tab>("transcript");
  const [query, setQuery] = useState("");
  const [hadSummaryOnLoad] = useState(() => !!upload.summary);
  const [seenSummary, setSeenSummary] = useState(false);
  const activeRef = useRef<HTMLDivElement>(null);

  const segments = useMemo(() => upload.segments ?? [], [upload.segments]);
  const blocks = useMemo(() => groupSegments(segments), [segments]);
  const activeIndex = segments.findIndex((s) => currentTime >= s.start && currentTime < s.end);

  const q = query.trim();
  const visibleBlocks = q
    ? blocks.filter((b) => b.items.some(({ segment }) => segment.text.toLowerCase().includes(q.toLowerCase())))
    : blocks;
  const matchCount = q
    ? segments.reduce((n, s) => n + (s.text.match(new RegExp(escapeRegExp(q), "gi"))?.length ?? 0), 0)
    : 0;

  const activeBlock = blocks.findIndex((b) => b.items.some(({ index }) => index === activeIndex));

  useEffect(() => {
    if (activeBlock >= 0 && !q) activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeBlock, q]);

  const summaryNew = !!upload.summary && !hadSummaryOnLoad && !seenSummary && tab !== "summary";

  return (
    <section className="flex min-h-[32rem] flex-col rounded-2xl border border-neutral-200/80 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 p-3 sm:p-4">
        <div className="flex rounded-xl bg-neutral-100/80 p-1">
          {(
            [
              { id: "transcript", label: "Transcript", icon: DocIcon },
              { id: "summary", label: "Summary", icon: SparklesIcon },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setTab(id);
                if (id === "summary") setSeenSummary(true);
              }}
              className={`relative flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ${
                tab === id ? "bg-white text-ink shadow-sm" : "text-neutral-500 hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {id === "summary" && summaryNew && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pop rounded-full bg-brand-500" />
              )}
            </button>
          ))}
        </div>

        {tab === "transcript" && segments.length > 0 && (
          <span className="ml-auto flex items-center gap-1.5 font-mono text-[11px] text-neutral-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Synced to playback
          </span>
        )}
        {tab === "summary" && upload.summary && (
          <span className="ml-auto">
            <CopyButton text={upload.summary} />
          </span>
        )}
      </div>

      {tab === "transcript" ? (
        <div className="flex flex-1 flex-col">
          {upload.transcript != null && segments.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 px-3 pt-3 sm:px-4">
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-neutral-100/80 px-3 py-2 text-sm transition focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100">
                <SearchIcon className="h-4 w-4 shrink-0 text-neutral-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search transcript..."
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-neutral-400"
                />
                {q && <span className="shrink-0 font-mono text-[11px] text-neutral-500">{matchCount} match(es)</span>}
              </label>
              <CopyButton text={upload.transcript} />
            </div>
          )}

          <div className="max-h-[38rem] flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
            {upload.transcript == null ? (
              <TranscriptPending upload={upload} />
            ) : segments.length === 0 ? (
              upload.transcript ? (
                <p className="animate-fade-up whitespace-pre-wrap leading-relaxed text-neutral-700">{upload.transcript}</p>
              ) : (
                <p className="py-10 text-center text-sm text-neutral-500">No speech was detected in this recording.</p>
              )
            ) : visibleBlocks.length === 0 ? (
              <p className="py-10 text-center text-sm text-neutral-500">No matches for &quot;{q}&quot;.</p>
            ) : (
              visibleBlocks.map((block, i) => {
                const isActive = blocks.indexOf(block) === activeBlock;
                return (
                  <div
                    key={block.start}
                    ref={isActive ? activeRef : undefined}
                    className={`animate-fade-up rounded-xl border p-4 transition-all duration-300 ${
                      isActive ? "border-brand-200 bg-brand-50/40 shadow-sm shadow-brand-600/10" : "border-neutral-100 hover:border-neutral-200"
                    }`}
                    style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
                  >
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        Passage {blocks.indexOf(block) + 1}
                        {isActive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-600" />}
                      </span>
                      <button
                        onClick={() => onSeek(block.start)}
                        className={`font-mono text-[11px] tabular-nums transition hover:text-brand-700 hover:underline ${
                          isActive ? "text-brand-600" : "text-neutral-400"
                        }`}
                        title="Play from here"
                      >
                        {formatDuration(block.start)} – {formatDuration(block.end)}
                      </button>
                    </div>
                    <p className="text-[15px] leading-relaxed text-neutral-700">
                      {block.items.map(({ segment, index }) => (
                        <span
                          key={index}
                          onClick={() => onSeek(segment.start)}
                          title={`Play from ${formatDuration(segment.start)}`}
                          className={`cursor-pointer rounded px-0.5 transition-colors duration-200 hover:bg-neutral-100 ${
                            index === activeIndex ? "bg-brand-100 text-brand-700 hover:bg-brand-100" : ""
                          }`}
                        >
                          {highlight(segment.text, q)}{" "}
                        </span>
                      ))}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 p-4 sm:p-6">
          {upload.summary ? (
            <div className="animate-fade-up">
              <Markdown text={upload.summary} />
            </div>
          ) : (
            <SummaryPending upload={upload} />
          )}
        </div>
      )}
    </section>
  );
}

function TranscriptPending({ upload }: { upload: UploadDetail }) {
  if (upload.status === "FAILED") {
    return <p className="py-16 text-center text-sm text-neutral-500">No transcript. See the error on the left and retry.</p>;
  }
  const listening = upload.status === "TRANSCRIBING";
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <span className="absolute inset-0 animate-ping-slow rounded-full bg-brand-100" />
        <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-brand-50">
          <Waveform bars={7} className="h-8" />
        </span>
      </div>
      <p className="mt-5 font-semibold">
        <span className="loading-dots">{listening ? "Gnani is listening" : "Getting your audio ready"}</span>
      </p>
      <p className="mt-1 max-w-sm text-sm text-neutral-500">
        {listening
          ? "The transcript appears here as soon as every chunk is done. Long recordings can take a few minutes."
          : "Converting to 16 kHz mono and splitting long audio into chunks."}
      </p>
      <div className="mt-8 w-full max-w-md opacity-70">
        <SkeletonLines count={5} />
      </div>
    </div>
  );
}

function SummaryPending({ upload }: { upload: UploadDetail }) {
  if (upload.status === "FAILED") {
    return <p className="py-16 text-center text-sm text-neutral-500">No summary yet. Use retry on the left.</p>;
  }
  const generating = upload.status === "SUMMARIZING";
  return (
    <div className="py-6">
      <div className="mb-6 flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-white ${generating ? "animate-float" : ""}`}>
          <SparklesIcon className="h-5 w-5" />
        </span>
        <div>
          <p className="font-semibold">
            {generating ? <span className="loading-dots">Writing the summary</span> : "Summary comes after the transcript"}
          </p>
          <p className="text-sm text-neutral-500">
            {generating ? "The LLM is reading the full transcript." : "It is generated as soon as transcription finishes."}
          </p>
        </div>
      </div>
      <div className={generating ? "" : "opacity-40"}>
        <div className="skeleton mb-4 h-4 w-1/3" />
        <SkeletonLines count={6} />
      </div>
    </div>
  );
}
