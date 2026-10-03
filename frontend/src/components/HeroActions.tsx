"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";

export default function HeroActions({ centered = false }: { centered?: boolean }) {
  const { user, loading } = useAuth();

  const primary =
    "rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:-translate-y-0.5 hover:bg-brand-700";
  const secondary =
    "rounded-xl border border-neutral-200 bg-white px-6 py-3 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:border-brand-200";

  return (
    <div className={`flex flex-wrap gap-3 ${centered ? "justify-center" : ""} ${loading ? "opacity-0" : "animate-fade-up"}`}>
      {user ? (
        <Link href="/studio" className={primary}>
          Open Studio
        </Link>
      ) : (
        <>
          <Link href="/signup" className={primary}>
            Get started free
          </Link>
          <Link href="/login" className={secondary}>
            Log in
          </Link>
        </>
      )}
      <Link href="/architecture" className={secondary}>
        How it works
      </Link>
    </div>
  );
}
