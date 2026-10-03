"use client";

import { type RefObject, useEffect, useState } from "react";
import StatusBadge from "./StatusBadge";
import Waveform from "./Waveform";
import { BackIcon, ForwardIcon, PauseIcon, PlayIcon } from "./Icons";
import { LANGUAGES, type UploadDetail, audioUrl, formatBytes, formatDuration, isTerminal } from "@/lib/api";

export default function AudioPlayer({
  upload,
  audioRef,
  onTime,
}: {
  upload: UploadDetail;
  audioRef: RefObject<HTMLAudioElement | null>;
  onTime: (seconds: number) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(upload.duration_seconds ?? 0);
  const [error, setError] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrent(audio.currentTime);
      onTime(audio.currentTime);
    };
    const onMeta = () => Number.isFinite(audio.duration) && setDuration(audio.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onError = () => setError(true);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onPause);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onPause);
      audio.removeEventListener("error", onError);
    };
  }, [audioRef, onTime]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => setError(true));
    else audio.pause();
  };

  const skip = (delta: number) => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = Math.min(Math.max(0, audio.currentTime + delta), duration || audio.duration || 0);
  };

  const fill = duration ? (current / duration) * 100 : 0;
  const processing = !isTerminal(upload.status);

  return (
    <section className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm sm:p-5">
      <audio ref={audioRef} src={audioUrl(upload.id)} preload="metadata" />

      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50">
          <Waveform active={playing || processing} bars={5} className="h-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="break-words font-bold leading-snug">{upload.filename}</h1>
          <p className="mt-0.5 font-mono text-[11px] text-neutral-500">
            {[
              formatDuration(upload.duration_seconds),
              formatBytes(upload.size_bytes),
              LANGUAGES[upload.language_code] ?? upload.language_code,
              upload.chunk_count != null && `${upload.chunk_count} chunk(s)`,
            ]
              .filter(Boolean)
              .map((item) => (
                <span key={String(item)} className="mr-2 whitespace-nowrap">
                  {item}
                </span>
              ))}
          </p>
        </div>
        <StatusBadge status={upload.status} />
      </div>

      <div className="mt-5">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(current, duration || 0)}
          onChange={(e) => {
            if (audioRef.current) audioRef.current.currentTime = Number(e.target.value);
          }}
          aria-label="Seek"
          className="seek w-full"
          style={{ "--fill": `${fill}%` } as React.CSSProperties}
        />
        <div className="mt-1 flex justify-between font-mono text-[11px] font-medium text-brand-600 tabular-nums">
          <span>{formatDuration(current)}</span>
          <span className="text-neutral-400">{formatDuration(duration)}</span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-center gap-5">
        <button onClick={() => skip(-10)} className="rounded-full p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-ink" title="Back 10s">
          <BackIcon className="h-5 w-5" />
        </button>
        <button
          onClick={toggle}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 transition hover:scale-105 hover:bg-brand-700 active:scale-95"
          title={playing ? "Pause" : "Play"}
        >
          {playing ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="ml-0.5 h-5 w-5" />}
        </button>
        <button onClick={() => skip(10)} className="rounded-full p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-ink" title="Forward 10s">
          <ForwardIcon className="h-5 w-5" />
        </button>
      </div>

      {error && <p className="mt-2 text-center text-xs text-red-600">The original audio could not be loaded for playback.</p>}
    </section>
  );
}
