"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";
import Waveform from "./Waveform";
import { AlertIcon, LogoIcon } from "./Icons";

// After login go back to where the user was sent from, or the studio.
// Only follow ?next= if it is a path on this site. "//evil.com" or a
// full URL would otherwise turn the login page into an open redirect.
function safeNext(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/studio";
}

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const { user, loading, login, register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isSignup = mode === "signup";

  // Already logged in: nothing to do here.
  useEffect(() => {
    if (!loading && user) router.replace(safeNext());
  }, [loading, user, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (isSignup && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      await (isSignup ? register : login)(email, password);
      router.replace(safeNext());
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-4xl overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm md:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-linear-to-br from-brand-600 to-brand-700 p-8 text-white md:flex">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
            <LogoIcon className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold">AudioNotes</span>
        </div>
        <div>
          <Waveform bars={20} className="h-16" color="bg-white/70" />
          <p className="mt-6 text-2xl font-bold leading-snug">Every recording, turned into a transcript and a summary.</p>
          <p className="mt-2 text-sm text-white/75">
            Free plan includes 10 uploads. Long recordings are split and transcribed with Gnani ASR.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="p-6 sm:p-10">
        <p className="font-mono text-[11px] uppercase tracking-wider text-brand-600">
          {isSignup ? "Create account" : "Welcome back"}
        </p>
        <h1 className="mt-1 text-2xl font-bold">{isSignup ? "Sign up for AudioNotes" : "Log in to AudioNotes"}</h1>

        <label className="mt-6 block text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          placeholder="you@example.com"
        />

        <label className="mt-4 block text-sm font-medium" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          placeholder={isSignup ? "At least 8 characters" : "Your password"}
        />

        {error && (
          <div className="mt-4 flex animate-fade-up items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-600/25 transition hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? <span className="loading-dots">{isSignup ? "Creating account" : "Logging in"}</span> : isSignup ? "Create account" : "Log in"}
        </button>

        <p className="mt-6 text-center text-sm text-slate-500">
          {isSignup ? "Already have an account? " : "New here? "}
          <Link href={isSignup ? "/login" : "/signup"} className="font-semibold text-brand-600 hover:underline">
            {isSignup ? "Log in" : "Create an account"}
          </Link>
        </p>
      </form>
    </div>
  );
}
