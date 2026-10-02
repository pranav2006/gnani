import { isTerminal, type UploadStatus } from "@/lib/api";

const STYLES: Record<UploadStatus, string> = {
  QUEUED: "bg-neutral-100 text-neutral-600",
  PREPROCESSING: "bg-neutral-100 text-neutral-900",
  TRANSCRIBING: "bg-neutral-100 text-neutral-900",
  SUMMARIZING: "bg-neutral-100 text-neutral-900",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  FAILED: "bg-red-50 text-red-700",
};

const DOTS: Record<UploadStatus, string> = {
  QUEUED: "bg-neutral-400",
  PREPROCESSING: "bg-brand-500",
  TRANSCRIBING: "bg-brand-500",
  SUMMARIZING: "bg-brand-500",
  COMPLETED: "bg-emerald-500",
  FAILED: "bg-red-500",
};

const LABELS: Record<UploadStatus, string> = {
  QUEUED: "Queued",
  PREPROCESSING: "Preparing",
  TRANSCRIBING: "Transcribing",
  SUMMARIZING: "Summarising",
  COMPLETED: "Ready",
  FAILED: "Failed",
};

export default function StatusBadge({ status }: { status: UploadStatus }) {
  const live = !isTerminal(status);
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium ${STYLES[status]}`}>
      <span className="relative flex h-1.5 w-1.5">
        {live && <span className={`absolute inline-flex h-full w-full rounded-full ${DOTS[status]} animate-ping-slow`} />}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${DOTS[status]}`} />
      </span>
      {LABELS[status]}
    </span>
  );
}
