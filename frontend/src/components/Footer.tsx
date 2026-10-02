import { WaveIcon } from "./Icons";
import { MAX_UPLOAD_MB } from "@/lib/api";

const FORMATS = ["MP3", "WAV", "M4A", "FLAC", "OGG", "AAC", "WEBM"];

export default function Footer() {
  return (
    <footer className="border-t border-slate-200/70 bg-white/70">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 text-xs text-slate-500 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <WaveIcon className="h-4 w-4 text-brand-600" />
          <span className="font-semibold uppercase tracking-wider text-slate-700">Supported formats</span>
          {FORMATS.map((f) => (
            <span key={f} className="rounded bg-brand-50 px-1.5 py-0.5 font-mono text-[10px] text-brand-700">
              {f}
            </span>
          ))}
          <span className="font-mono">≤ {MAX_UPLOAD_MB} MB · any length</span>
        </div>
        <span className="ml-auto font-mono">Transcription: Gnani Batch STT · Summary: Groq LLM</span>
      </div>
    </footer>
  );
}
