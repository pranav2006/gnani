"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { GitHubIcon, LogoIcon } from "./Icons";
import { API_URL, GITHUB_URL } from "@/lib/api";

const TABS = [
  { href: "/studio", label: "Studio", match: (p: string) => p.startsWith("/studio") || p.startsWith("/uploads") },
  { href: "/pricing", label: "Pricing", match: (p: string) => p.startsWith("/pricing") },
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
          <AccountMenu />
        </div>
      </nav>
    </header>
  );
}

function AccountMenu() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the dropdown when clicking anywhere else.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (loading) return <div className="skeleton h-9 w-9 rounded-full!" />;

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:text-ink">
          Log in
        </Link>
        <Link
          href="/signup"
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand-600/25 transition hover:-translate-y-0.5 hover:bg-brand-700"
        >
          Sign up
        </Link>
      </div>
    );
  }

  const limit = user.upload_limit;
  const used = user.uploads_used;

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 transition hover:border-brand-200"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold uppercase text-white">
          {user.email[0]}
        </span>
        <span className="font-mono text-[11px] text-slate-600">
          {limit == null ? "PRO" : `${used}/${limit}`}
        </span>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-64 animate-fade-up rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/10">
          <p className="truncate text-sm font-semibold">{user.email}</p>
          <span
            className={`mt-1 inline-block rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${
              user.plan === "pro" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {user.plan} plan
          </span>

          {limit != null && (
            <div className="mt-4">
              <div className="flex justify-between font-mono text-[11px] text-slate-500">
                <span>Uploads used</span>
                <span>
                  {used} / {limit}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${used >= limit ? "bg-red-500" : "bg-brand-600"}`}
                  style={{ width: `${Math.min(100, (used / limit) * 100)}%` }}
                />
              </div>
              <Link
                href="/pricing"
                onClick={() => setOpen(false)}
                className="mt-3 block rounded-lg bg-brand-50 py-2 text-center text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
              >
                Upgrade to Pro
              </Link>
            </div>
          )}

          <button
            onClick={() => {
              logout();
              setOpen(false);
              router.push("/login");
            }}
            className="mt-3 w-full rounded-lg py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-red-600"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
