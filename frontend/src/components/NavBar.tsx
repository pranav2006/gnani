"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CloudUploadIcon, GitHubIcon, LogoIcon } from "./Icons";
import { API_URL, GITHUB_URL } from "@/lib/api";

const TABS = [
  { href: "/", label: "Studio", match: (p: string) => p === "/" || p.startsWith("/uploads") },
  { href: "/architecture", label: "Architecture", match: (p: string) => p.startsWith("/architecture") },
];

type Health = "checking" | "online" | "offline";

// Real health check against the backend, so the pill tells the truth.
function useApiHealth(): Health {
  const [health, setHealth] = useState<Health>("checking");

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const response = await fetch(`${API_URL}/health`, { cache: "no-store" });
        if (!cancelled) setHealth(response.ok ? "online" : "offline");
      } catch {
        if (!cancelled) setHealth("offline");
      }
    }

    check();
    const timer = setInterval(check, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return health;
}

export default function NavBar() {
  const pathname = usePathname();
  const health = useApiHealth();

  const dot = { checking: "bg-amber-400", online: "bg-emerald-500", offline: "bg-red-500" }[health];
  const label = { checking: "Connecting", online: "Gnani ASR · API online", offline: "API unreachable" }[health];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <LogoIcon className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold tracking-tight">AudioNotes</span>
          <span className="hidden rounded-md bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-600 sm:inline">
            Gnani ASR
          </span>
        </Link>

        <div className="flex rounded-xl bg-slate-100/80 p-1">
          {TABS.map((tab) => {
            const active = tab.match(pathname);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 sm:px-4 ${
                  active ? "bg-brand-600 text-white shadow-sm shadow-brand-600/30" : "text-slate-600 hover:text-ink"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 font-mono text-[11px] text-slate-600 md:flex">
            <span className="relative flex h-2 w-2">
              {health === "online" && <span className={`absolute inline-flex h-full w-full rounded-full ${dot} animate-ping-slow`} />}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
            </span>
            {label}
          </span>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-ink sm:block"
            title="Source on GitHub"
          >
            <GitHubIcon className="h-5 w-5" />
          </a>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-md shadow-brand-600/25 transition hover:-translate-y-0.5 hover:bg-brand-700 sm:px-4"
          >
            <CloudUploadIcon className="h-4 w-4" />
            <span className="hidden sm:inline">New upload</span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
