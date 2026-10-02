import Link from "next/link";
import HeroActions from "@/components/HeroActions";
import Waveform from "@/components/Waveform";
import { CheckIcon, DocIcon, RetryIcon, SearchIcon, SparklesIcon, UploadIcon, WaveIcon } from "@/components/Icons";
import { LANGUAGES } from "@/lib/api";

const STEPS = [
  { n: "01", title: "Upload", text: "Drop in a recording of any length. It's checked straight away, so a broken file is caught in seconds." },
  { n: "02", title: "Prepare", text: "Audio is converted to 16 kHz mono and long recordings are split into 10-minute chunks." },
  { n: "03", title: "Transcribe", text: "Gnani's speech recognition transcribes every chunk in one job, then it's stitched back with timestamps." },
  { n: "04", title: "Summarise", text: "An LLM reads the full transcript and writes an overview, key points and action items." },
];

const FEATURES = [
  { icon: UploadIcon, title: "Any length", text: "From a 10-second voice note to multi-hour recordings, up to 500 MB per file." },
  { icon: WaveIcon, title: "Synced to playback", text: "The transcript follows the audio. Click any sentence to jump straight to that moment." },
  { icon: SparklesIcon, title: "Instant summaries", text: "Overview, key points and action items, generated as soon as the transcript is ready." },
  { icon: SearchIcon, title: "Search everything", text: "Find any word in a transcript, with every match highlighted." },
  { icon: DocIcon, title: "Live progress", text: "See each stage as it happens: preparing, transcribing, summarising. Never a frozen page." },
  { icon: RetryIcon, title: "Visible failures", text: "If something breaks you see exactly what and where, with one-click retry." },
];

const SAMPLE = [
  { t: "0:04", text: "Okay, let's get started. The main thing today is the launch timeline for next month." },
  { t: "0:31", text: "Design is done, but the payment flow still needs another round of testing.", active: true },
  { t: "0:58", text: "Let's move the release to the 18th so QA has the full week." },
];

function ProductPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-[2rem] bg-linear-to-br from-brand-200/50 via-neutral-200/40 to-transparent blur-2xl" />
      <div className="relative animate-fade-up rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-2xl shadow-brand-600/10 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
            <Waveform bars={5} className="h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">team-sync-recording.m4a</p>
            <p className="font-mono text-[10px] text-neutral-500">42:18 · English (India) · 5 chunks</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-medium text-emerald-700">Ready</span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {["Prepare", "Transcribe", "Summarise"].map((stage) => (
            <div key={stage} className="rounded-lg border border-neutral-100 bg-neutral-50/60 p-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold">{stage}</span>
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <CheckIcon className="h-2 w-2" />
                </span>
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-emerald-500" />
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          {SAMPLE.map((line) => (
            <div
              key={line.t}
              className={`flex gap-3 rounded-lg p-2 text-[13px] leading-relaxed ${
                line.active ? "border border-brand-200 bg-brand-50/60" : ""
              }`}
            >
              <span className={`shrink-0 font-mono text-[11px] ${line.active ? "text-brand-600" : "text-neutral-400"}`}>{line.t}</span>
              <span className={line.active ? "text-brand-700" : "text-neutral-600"}>{line.text}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl bg-ink p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-500">
            <SparklesIcon className="h-3.5 w-3.5" /> Summary
          </p>
          <ul className="mt-1.5 space-y-1 text-[12px] text-white/80">
            <li>• Release moves to the 18th to give QA a full week.</li>
            <li>• Payment flow needs another round of testing.</li>
          </ul>
        </div>
      </div>
      <p className="mt-3 text-center font-mono text-[10px] text-neutral-400">Illustrative example</p>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="space-y-20 pb-8 sm:space-y-28">
      {/* Hero */}
      <section className="grid items-center gap-12 pt-4 lg:grid-cols-2 lg:pt-10">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-white px-3 py-1 font-mono text-[11px] text-brand-700">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> Powered by Gnani speech recognition
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            Turn any recording into <span className="text-brand-600">notes you can use</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-neutral-600">
            Upload a meeting, lecture, interview or voice memo. Get a timestamped transcript synced to the audio and
            an AI summary of what mattered, in minutes.
          </p>
          <div className="mt-8">
            <HeroActions />
          </div>
          <p className="mt-4 text-sm text-neutral-500">Free plan: 10 uploads. No card required.</p>
        </div>
        <ProductPreview />
      </section>

      {/* How it works */}
      <section>
        <p className="text-center font-mono text-[11px] uppercase tracking-wider text-brand-600">How it works</p>
        <h2 className="mt-2 text-center text-3xl font-bold tracking-tight">From audio file to notes in four steps</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <div
              key={step.n}
              className="relative animate-fade-up rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="font-mono text-sm font-semibold text-brand-600">{step.n}</span>
              <h3 className="mt-3 text-lg font-bold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section>
        <p className="text-center font-mono text-[11px] uppercase tracking-wider text-brand-600">Features</p>
        <h2 className="mt-2 text-center text-3xl font-bold tracking-tight">Built for long, real-world recordings</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="group rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-md hover:shadow-brand-600/5"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-bold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Languages */}
      <section className="rounded-2xl border border-neutral-200/80 bg-white px-6 py-10 text-center shadow-sm">
        <h2 className="text-2xl font-bold tracking-tight">Speaks your language</h2>
        <p className="mt-2 text-neutral-600">Transcription in English and seven Indian languages.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {Object.values(LANGUAGES).map((name) => (
            <span key={name} className="rounded-full bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
              {name}
            </span>
          ))}
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
          <p className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">Free</p>
          <p className="mt-2 text-3xl font-bold">₹0</p>
          <p className="mt-1 text-sm text-neutral-600">10 uploads with every feature included.</p>
        </div>
        <div className="rounded-2xl border border-brand-200 bg-white p-6 shadow-sm ring-2 ring-brand-100">
          <p className="font-mono text-[11px] uppercase tracking-wider text-brand-600">Pro</p>
          <p className="mt-2 text-3xl font-bold">
            ₹499<span className="text-base font-normal text-neutral-500"> / month</span>
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            Unlimited uploads.{" "}
            <Link href="/pricing" className="font-semibold text-brand-600 hover:underline">
              Compare plans →
            </Link>
          </p>
        </div>
      </section>

      {/* Final call to action */}
      <section className="relative overflow-hidden rounded-3xl bg-ink px-6 py-14 text-center text-white">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center opacity-20">
          <Waveform bars={40} className="h-24" color="bg-brand-500" />
        </div>
        <h2 className="relative text-3xl font-bold tracking-tight sm:text-4xl">Your next recording, already summarised</h2>
        <p className="relative mx-auto mt-3 max-w-lg text-white/70">
          Create a free account and upload your first file in under a minute.
        </p>
        <div className="relative mt-8 flex justify-center">
          <Link
            href="/signup"
            className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:-translate-y-0.5 hover:bg-brand-700"
          >
            Get started free
          </Link>
        </div>
      </section>
    </div>
  );
}
