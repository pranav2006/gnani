import type { Metadata } from "next";
import type { ReactNode } from "react";
import ArchitectureDiagram from "@/components/ArchitectureDiagram";
import CodeBlock from "@/components/CodeBlock";
import { GitHubIcon } from "@/components/Icons";
import { API_URL, GITHUB_URL } from "@/lib/api";

export const metadata: Metadata = { title: "Architecture · AudioNotes" };

const STEPS = [
  { n: "01", title: "You upload", text: "The file is checked right away and saved. You get a page that shows its progress." },
  { n: "02", title: "We prepare it", text: "In the background, the audio is shrunk and cut into 10-minute pieces." },
  { n: "03", title: "Gnani transcribes", text: "All pieces go to Gnani in one job. We stitch the text back together with timestamps." },
  { n: "04", title: "AI summarises", text: "An LLM on Groq reads the transcript and writes the key points." },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-2 space-y-2 leading-relaxed text-neutral-700">{children}</div>
    </section>
  );
}

export default function ArchitecturePage() {
  const curl = `# Upload a file
curl -X POST "${API_URL}/uploads/" \\
  -H "Authorization: Bearer <token>" \\
  -F "file=@meeting.mp3" -F "language_code=en-IN"

# Check progress and get the result
curl "${API_URL}/uploads/<id>" -H "Authorization: Bearer <token>"`;

  return (
    <article className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-brand-600">Architecture</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">How it works</h1>
          <p className="mt-2 max-w-xl text-neutral-600">The picture says most of it. The notes below fill in the details.</p>
        </div>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-neutral-800"
        >
          <GitHubIcon className="h-4 w-4" /> View the code
        </a>
      </header>

      <ArchitectureDiagram />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step) => (
          <div key={step.n} className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm">
            <span className="font-mono text-sm font-semibold text-brand-600">{step.n}</span>
            <h3 className="mt-2 font-bold">{step.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-neutral-600">{step.text}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Where files live">
          <p>
            Your original audio is kept in a private storage bucket. Everything else (status, transcript, summary) is
            saved in a Postgres database. The small pieces we cut for Gnani are temporary and deleted once the job is
            done.
          </p>
        </Section>

        <Section title="What happens instantly vs in the background">
          <p>
            <b>Instantly:</b> checking the file, saving it, and putting the job in a queue. This takes seconds, so
            you&apos;re never left waiting on a spinning upload.
          </p>
          <p>
            <b>In the background:</b> converting, transcribing and summarising. A separate worker does this, so it
            keeps going even if you close the tab. The page checks in every few seconds to show progress.
          </p>
        </Section>

        <Section title="Long recordings">
          <p>
            Gnani accepts files up to 10 MB each. A one-hour recording can be hundreds of MB, so we convert it to
            small, speech-quality audio and cut it into 10-minute pieces (about 2.4 MB each). All pieces go in one
            job, which handles recordings of 16+ hours. Each piece&apos;s timestamps are shifted so the final
            transcript lines up with the original audio.
          </p>
        </Section>

        <Section title="When things go wrong">
          <ul className="ml-5 list-disc space-y-1">
            <li>Broken or unsupported files are rejected during upload, with a clear reason.</li>
            <li>Busy or failing services are retried automatically.</li>
            <li>If something still fails, you see where and why, plus a Retry button.</li>
            <li>If only the summary fails, the transcript is kept and only the summary is redone.</li>
            <li>If a worker crashes mid-job, it picks up the same job again instead of starting over.</li>
          </ul>
        </Section>

        <Section title="Accounts and limits">
          <p>
            Passwords are stored as secure hashes, and each login gets a token that expires after a week. You only
            ever see your own uploads. The free plan has 10 uploads; the Pro upgrade is a demo and takes no payment.
          </p>
        </Section>

        <Section title="What I'd improve with more time">
          <ul className="ml-5 list-disc space-y-1">
            <li>Upload big files straight to storage instead of through the server.</li>
            <li>Let Gnani notify us when it&apos;s done, instead of checking every 10 seconds.</li>
            <li>Cut audio at pauses so no word gets split between pieces.</li>
            <li>Keep partial results if one piece fails.</li>
            <li>Real payments, password reset, and automated tests.</li>
          </ul>
        </Section>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold">Use the API directly</h2>
        <CodeBlock code={curl} label="bash" />
      </section>
    </article>
  );
}
