"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { AlertIcon, CheckIcon, SparklesIcon } from "@/components/Icons";
import { upgradePlan } from "@/lib/api";

const FREE_FEATURES = [
  "10 uploads",
  "Any length, up to 500 MB per file",
  "Timestamped transcript synced to playback",
  "LLM summary with key points",
];

const PRO_FEATURES = [
  "Unlimited uploads",
  "Everything in Free",
];

export default function PricingPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPro = user?.plan === "pro";
  const atLimit = !!user && user.upload_limit != null && user.uploads_used >= user.upload_limit;

  async function upgrade() {
    setUpgrading(true);
    setError(null);
    try {
      await upgradePlan();
      await refreshUser();
      router.push("/studio");
    } catch (e) {
      setError((e as Error).message);
      setUpgrading(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="text-center">
        <p className="font-mono text-[11px] uppercase tracking-wider text-brand-600">Pricing</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Pick a plan</h1>
        <p className="mx-auto mt-2 max-w-xl text-neutral-600">
          Start free with 10 uploads. Go Pro when you need more.
        </p>
        {atLimit && (
          <p className="mx-auto mt-4 flex w-fit animate-fade-up items-center gap-2 rounded-full bg-amber-50 px-4 py-1.5 text-sm text-amber-800">
            <AlertIcon className="h-4 w-4" /> You&apos;ve used all {user.upload_limit} free uploads.
          </p>
        )}
      </header>

      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
        <PlanCard
          name="Free"
          price="₹0"
          note="forever"
          features={FREE_FEATURES}
          action={
            !user ? (
              <Link href="/signup" className="block rounded-xl border border-neutral-200 py-2.5 text-center text-sm font-semibold transition hover:border-brand-200 hover:text-brand-700">
                Get started
              </Link>
            ) : (
              <p className="rounded-xl bg-neutral-50 py-2.5 text-center text-sm font-medium text-neutral-500">
                {isPro ? "Included" : "Your current plan"}
              </p>
            )
          }
        />

        <PlanCard
          highlighted
          name="Pro"
          price="₹499"
          note="per month"
          features={PRO_FEATURES}
          action={
            !user ? (
              <Link href="/signup?next=/pricing" className="block rounded-xl bg-brand-600 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-brand-600/25 transition hover:bg-brand-700">
                Sign up to upgrade
              </Link>
            ) : isPro ? (
              <p className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-700">
                <CheckIcon className="h-4 w-4" /> Your current plan
              </p>
            ) : (
              <>
                <button
                  onClick={upgrade}
                  disabled={upgrading}
                  className="w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-600/25 transition hover:-translate-y-0.5 hover:bg-brand-700 disabled:opacity-60"
                >
                  {upgrading ? <span className="loading-dots">Upgrading</span> : "Upgrade to Pro"}
                </button>
                <p className="mt-2 text-center text-[11px] text-neutral-400">Demo checkout: no payment is taken.</p>
                {error && <p className="mt-2 text-center text-xs text-red-600">{error}</p>}
              </>
            )
          }
        />
      </div>
    </div>
  );
}

function PlanCard({
  name,
  price,
  note,
  features,
  action,
  highlighted = false,
}: {
  name: string;
  price: string;
  note: string;
  features: string[];
  action: React.ReactNode;
  highlighted?: boolean;
}) {
  return (
    <section
      className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md sm:p-8 ${
        highlighted ? "border-brand-200 shadow-brand-600/10 ring-2 ring-brand-100" : "border-neutral-200/80"
      }`}
    >
      {highlighted && (
        <span className="absolute -top-3 left-6 flex items-center gap-1 rounded-full bg-brand-600 px-3 py-1 text-[11px] font-semibold text-white">
          <SparklesIcon className="h-3.5 w-3.5" /> Most popular
        </span>
      )}
      <h2 className="text-lg font-bold">{name}</h2>
      <p className="mt-3">
        <span className="text-4xl font-bold tracking-tight">{price}</span>
        <span className="ml-1 text-sm text-neutral-500">{note}</span>
      </p>
      <ul className="mt-6 flex-1 space-y-2.5">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-neutral-700">
            <CheckIcon className={`mt-0.5 h-4 w-4 shrink-0 ${highlighted ? "text-brand-600" : "text-emerald-500"}`} />
            {feature}
          </li>
        ))}
      </ul>
      <div className="mt-8">{action}</div>
    </section>
  );
}
