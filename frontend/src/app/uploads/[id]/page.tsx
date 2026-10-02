"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import AudioPlayer from "@/components/AudioPlayer";
import PipelineCard from "@/components/PipelineCard";
import RequireAuth from "@/components/RequireAuth";
import ResultsPanel from "@/components/ResultsPanel";
import UploadForm from "@/components/UploadForm";
import { AlertIcon } from "@/components/Icons";
import { type UploadDetail, getUpload, isTerminal, retryUpload } from "@/lib/api";

const POLL_MS = 2500;

export default function UploadPage() {
  return (
    <RequireAuth>
      <UploadView />
    </RequireAuth>
  );
}

function UploadView() {
  const { id } = useParams<{ id: string }>();
  const [upload, setUpload] = useState<UploadDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [connectionLost, setConnectionLost] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [pollKey, setPollKey] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Poll the backend until the upload reaches COMPLETED or FAILED.
  // Network errors don't stop polling; we show a banner and back off.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;

    async function poll() {
      try {
        const data = await getUpload(id);
        if (cancelled) return;
        failures = 0;
        setUpload(data);
        setConnectionLost(false);
        if (!isTerminal(data.status)) timer = setTimeout(poll, POLL_MS);
      } catch (e) {
        if (cancelled) return;
        const message = (e as Error).message;
        if (message === "Upload not found.") {
          setLoadError(message);
          return;
        }
        failures += 1;
        setConnectionLost(true);
        setLoadError(message); // only shown if we never loaded the upload
        timer = setTimeout(poll, Math.min(POLL_MS * 2 ** failures, 30000));
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, pollKey]);

  async function retry() {
    setRetrying(true);
    setRetryError(null);
    try {
      setUpload(await retryUpload(id));
      setPollKey((k) => k + 1); // restart polling
    } catch (e) {
      setRetryError((e as Error).message);
    } finally {
      setRetrying(false);
    }
  }

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    audio.play().catch(() => {});
  }, []);

  if (!upload) {
    return (
      <div className="space-y-4">
        <Link href="/studio" className="text-sm font-medium text-brand-600 hover:underline">
          ← Back to studio
        </Link>
        {loadError ? (
          <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertIcon className="h-4 w-4" /> {loadError}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div className="space-y-4">
              <div className="skeleton h-48 rounded-2xl!" />
              <div className="skeleton h-32 rounded-2xl!" />
            </div>
            <div className="skeleton h-96 rounded-2xl!" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/studio" className="text-sm font-medium text-brand-600 hover:underline">
          ← Back to studio
        </Link>
        {connectionLost && (
          <span className="flex animate-fade-up items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800">
            <AlertIcon className="h-3.5 w-3.5" />
            <span className="loading-dots">Connection lost, reconnecting. Your file keeps processing</span>
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-4">
          <AudioPlayer upload={upload} audioRef={audioRef} onTime={setCurrentTime} />
          <PipelineCard upload={upload} onRetry={retry} retrying={retrying} retryError={retryError} />
          <UploadForm compact />
        </div>
        <ResultsPanel upload={upload} currentTime={currentTime} onSeek={seek} />
      </div>
    </div>
  );
}
