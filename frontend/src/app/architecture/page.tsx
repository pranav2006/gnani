import type { Metadata } from "next";
import type { ReactNode } from "react";
import CodeBlock from "@/components/CodeBlock";
import { GitHubIcon } from "@/components/Icons";
import { API_URL, GITHUB_URL } from "@/lib/api";

export const metadata: Metadata = { title: "Architecture · AudioNotes" };

// Real numbers from the code, not benchmarks.
const STATS = [
  { label: "Chunk size", value: "10 min", note: "~2.4 MB each at 16 kHz mono, 32 kbps (Gnani limit: 10 MB per file)" },
  { label: "Max per upload", value: "100 chunks", note: "One Gnani batch job, so ~16 h of audio" },
  { label: "Status refresh", value: "2.5 s", note: "Frontend polling; the worker polls Gnani every 10 s" },
];

const PIPELINE = [
  { n: "01", title: "Upload & validate", where: "API · sync", text: "Streamed to disk in 1 MB pieces, size-checked, ffprobe-validated, stored in the bucket, row created, task queued." },
  { n: "02", title: "Prepare audio", where: "Worker", text: "ffmpeg converts to 16 kHz mono MP3 and cuts 10-minute chunks in one pass." },
  { n: "03", title: "Transcribe", where: "Worker → Gnani", text: "All chunks in one batch job: create, start, poll progress, download each transcript, shift timestamps." },
  { n: "04", title: "Summarise", where: "Worker → Groq", text: "One LLM call for short transcripts; map-reduce over ~12k-character pieces for long ones." },
];

const DIAGRAM = `Browser (Next.js on Vercel)
  │  1. POST /uploads  (multipart, XHR upload progress)
  ▼
FastAPI ──── 2. ffprobe check (sync) ──► reject corrupt / non-audio (400)
  │  3. save original ──────────────────► S3-compatible bucket
  │  4. INSERT row (status=QUEUED) ─────► Postgres
  │  5. enqueue task id ────────────────► Redis
  ▼
Celery worker (background)
  │  6. download original from bucket
  │  7. ffmpeg → 16 kHz mono MP3, cut into 10-min chunks
  │  8. one Gnani batch job with all chunks → start → poll every 10 s
  │  9. download each chunk's transcript JSON, shift timestamps, join
  │ 10. Groq LLM summary (map-reduce if long)
  │     every step updates status / progress / stage_detail in Postgres
  ▼
Browser polls GET /uploads/{id} every 2.5 s and renders progress → result`;

function Card({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm sm:p-6">
      <p className="font-mono text-[11px] uppercase tracking-wider text-brand-600">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-bold">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-neutral-700">{children}</div>
    </section>
  );
}

export default function ArchitecturePage() {
  const curl = `# Upload a file (returns the upload with status QUEUED)
curl -X POST "${API_URL}/uploads/" \\
  -F "file=@meeting.mp3" \\
  -F "language_code=en-IN"

# Poll status, progress, transcript and summary
curl "${API_URL}/uploads/<id>"

# Retry a failed upload (re-runs only the summary if the transcript exists)
curl -X POST "${API_URL}/uploads/<id>/retry"`;

  return (
    <article className="space-y-6">
      <header className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm sm:p-8">
        <p className="font-mono text-[11px] uppercase tracking-wider text-brand-600">System architecture</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">How AudioNotes works</h1>
        <p className="mt-2 max-w-2xl text-neutral-600">
          From an uploaded file to a timestamped transcript and a summary: where each step runs, where files live, and
          how long recordings and failures are handled.
        </p>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-neutral-800"
        >
          <GitHubIcon className="h-4 w-4" /> Source code on GitHub
        </a>

        <dl className="mt-8 grid gap-6 border-t border-neutral-100 pt-6 sm:grid-cols-3">
          {STATS.map((stat) => (
            <div key={stat.label}>
              <dt className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">{stat.label}</dt>
              <dd className="mt-1 font-mono text-3xl font-semibold text-brand-600">{stat.value}</dd>
              <dd className="mt-1 text-xs text-neutral-500">{stat.note}</dd>
            </div>
          ))}
        </dl>
      </header>

      <section>
        <p className="font-mono text-[11px] uppercase tracking-wider text-brand-600">Pipeline flow</p>
        <h2 className="mt-1 text-xl font-bold">Processing sequence</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PIPELINE.map((step) => (
            <div
              key={step.n}
              className="flex flex-col rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:shadow-brand-600/5"
            >
              <span className="font-mono text-xs font-semibold text-brand-600">{step.n}</span>
              <h3 className="mt-2 font-bold">{step.title}</h3>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-neutral-600">{step.text}</p>
              <p className="mt-4 border-t border-neutral-100 pt-3 font-mono text-[11px] text-neutral-500">Runs in: {step.where}</p>
            </div>
          ))}
        </div>
      </section>

      <Card eyebrow="Overview" title="Components and flow from upload to transcript">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <b>Frontend</b>: Next.js (App Router) on Vercel. The studio (upload + history), an upload detail page, and
            this page.
          </li>
          <li>
            <b>API</b>: FastAPI. Accepts uploads, serves status and results, handles retries.
          </li>
          <li>
            <b>Worker</b>: Celery with Redis as the broker. Runs the long pipeline (ffmpeg, Gnani, LLM).
          </li>
          <li>
            <b>Postgres</b>: one <code>audio_uploads</code> table, the source of truth for each upload&apos;s status,
            progress, transcript, timestamped segments and summary.
          </li>
          <li>
            <b>Storage bucket</b>: S3-compatible object storage holding the original audio files.
          </li>
          <li>
            <b>Gnani Batch STT</b> for transcription, <b>Groq</b> (OpenAI gpt-oss-120b) for the summary.
          </li>
        </ul>
        <div className="overflow-x-auto rounded-xl bg-neutral-900 p-4">
          <pre className="font-mono text-xs leading-relaxed text-neutral-100">{DIAGRAM}</pre>
        </div>
        <p>
          The browser uploads with <code>XMLHttpRequest</code> so it can show real upload progress (fetch has no
          upload-progress events). The API streams the body to a temp file in 1 MB pieces (never holding the whole file
          in memory), enforces a size limit, and runs <code>ffprobe</code>. That check takes milliseconds and rejects
          corrupted or non-audio files immediately with a clear message, instead of failing minutes later. The API then
          stores the original in the bucket, inserts a row with status <code>QUEUED</code>, pushes the upload id onto
          the Celery queue and returns. The browser opens the upload&apos;s page.
        </p>
        <p>
          The worker moves the row through <code>PREPROCESSING → TRANSCRIBING → SUMMARIZING → COMPLETED</code>. Each
          step writes a 0–100 <code>progress</code> and a readable <code>stage_detail</code> (for example
          &quot;Transcribing: 3 of 7 chunk(s) done&quot;), which the detail page polls and renders as the pipeline
          tiles and the progress bar.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card eyebrow="Storage" title="Where files live">
          <p>
            Originals go to an S3-compatible bucket under <code>uploads/&lt;upload-id&gt;/&lt;filename&gt;</code>. The
            API and the worker are separate containers that don&apos;t share a disk, so the bucket is how the file gets
            from one to the other. The audio player gets a short-lived pre-signed URL and streams straight from the
            bucket. In local development the same functions write to a <code>./storage</code> folder.
          </p>
          <p>
            The converted chunks are temporary: the worker creates them in a temp directory that is deleted when the
            task ends. Transcripts, segments and summaries are rows in Postgres, not files.
          </p>
        </Card>

        <Card eyebrow="Execution" title="Synchronous vs background">
          <p>
            <b>Synchronous (in the upload request):</b> receiving the file, size and type checks, ffprobe validation,
            saving to the bucket, creating the row, enqueueing. All quick, and the user gets immediate feedback.
          </p>
          <p>
            <b>Background (Celery worker):</b> ffmpeg conversion and chunking, the Gnani job (create, start, poll,
            download), stitching the transcript, and the LLM summary. These take minutes and depend on external
            services; in a request they would hit HTTP timeouts and be lost on a disconnect.
          </p>
          <p>
            <b>Frontend:</b> polls <code>GET /uploads/&#123;id&#125;</code> every 2.5 s until the status is terminal;
            the library list refreshes while anything is still running.
          </p>
        </Card>
      </div>

      <Card eyebrow="Long audio" title="How long recordings are handled">
        <p>
          Gnani&apos;s synchronous REST endpoint accepts at most 60 seconds of audio, so I use the <b>Batch STT</b> API.
          Batch has its own limit: 10 MB per uploaded file. A 1-hour WAV is roughly 600 MB, and even a long MP3 can be
          over 10 MB.
        </p>
        <p>
          So the worker runs one ffmpeg pass that converts to 16 kHz mono, 32 kbps MP3 and cuts 10-minute chunks (about
          2.4 MB each). Gnani resamples everything to 16 kHz mono internally, so this conversion loses nothing the ASR
          would have used. All chunks are files of <b>one</b> batch job (up to 100 per job, so about 16 hours of audio),
          which lets Gnani process them in parallel and gives real progress (completed vs total files).
        </p>
        <p>
          When the job completes, the worker downloads each chunk&apos;s transcript JSON, orders chunks by name, and
          shifts every segment&apos;s timestamps by the chunk&apos;s start offset. The result is one transcript with
          timestamps relative to the original file, which is what makes the transcript follow the audio player.
        </p>
        <p>
          The summary uses map-reduce: a short transcript goes to the LLM in one request; a long one is split into
          ~12k-character pieces, each summarised, then the partial summaries are combined. This keeps every request well
          inside the free tier&apos;s tokens-per-minute limit.
        </p>
      </Card>

      <Card eyebrow="Reliability" title="Failure handling">
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            Bad files (wrong type, empty, too large, corrupted) are rejected during upload with a specific message.
            Network errors and cancellation during upload are shown in the upload card.
          </li>
          <li>
            Any exception in the worker marks the row <code>FAILED</code> with a readable <code>error_message</code> and
            the stage it failed in. The UI marks that stage red and offers <b>Retry</b>.
          </li>
          <li>
            If transcription succeeded but the summary failed, the transcript is still shown and the retry re-runs only
            the summary, so Gnani isn&apos;t called (or paid) twice.
          </li>
          <li>
            Gnani and Groq calls retry with backoff on 429/5xx. Starting a Gnani job is retried, because Gnani rate
            limits a start that follows right after a create (found in testing). Creating a job is not retried
            automatically, because that could create a duplicate job.
          </li>
          <li>
            The Gnani <code>job_id</code> is saved before the job is started. Celery uses late acknowledgement, so if a
            worker crashes the task is redelivered and resumes the same Gnani job (starting it if it never started)
            instead of uploading again. The broker&apos;s visibility timeout is raised to 6 hours so long jobs
            aren&apos;t redelivered while still running.
          </li>
          <li>
            Polling Gnani has a deadline (30 min + 2× the audio length), so a stuck job becomes a visible failure.
          </li>
          <li>
            If Redis is down at upload time the row is marked failed and the API returns 503, so nothing sits in{" "}
            <code>QUEUED</code> forever. If the browser loses its connection, the page shows a banner and keeps polling
            with backoff. The nav bar shows live API health.
          </li>
        </ul>
      </Card>

      <Card eyebrow="Accounts" title="Login and the free-plan limit">
        <p>
          Users sign up with email and password. Passwords are hashed with <b>bcrypt</b> (salted and deliberately slow)
          and never stored. Login returns a <b>JWT</b> signed with a server secret that holds the user id and a 7-day
          expiry; the frontend keeps it in <code>localStorage</code> and sends it as{" "}
          <code>Authorization: Bearer</code> on every request. The audio player is the exception: an{" "}
          <code>&lt;audio src&gt;</code> request can&apos;t carry headers, so that one endpoint also accepts the token
          as a query parameter.
        </p>
        <p>
          Every upload row has a <code>user_id</code>. All upload endpoints filter by the logged-in user, and someone
          else&apos;s upload returns the same 404 as a missing one, so ids can&apos;t be probed. The login page shows
          one message for &quot;unknown email&quot; and &quot;wrong password&quot; for the same reason.
        </p>
        <p>
          The free plan allows 10 uploads. The API checks the count before receiving the file (to fail fast), then
          again while holding a row lock on the user (<code>SELECT … FOR UPDATE</code>) right before inserting, so two
          simultaneous uploads can&apos;t both slip past the limit. Over the limit the API answers{" "}
          <code>402 Payment Required</code> and the UI swaps the upload card for an upgrade prompt. Retries don&apos;t
          count. The Pro upgrade is a <b>demo</b>: it flips the plan without taking payment. With a real provider the
          plan would only change from the provider&apos;s payment webhook.
        </p>
      </Card>

      <Card eyebrow="Next steps" title="What I'd do differently with more time">
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            <b>Direct-to-bucket uploads</b> with pre-signed multipart URLs, so large files skip the API server; ffprobe
            would move to the worker.
          </li>
          <li>
            <b>Gnani webhooks</b> (<code>callback_url</code>) instead of polling, freeing the worker while Gnani is busy.
          </li>
          <li>
            <b>Push updates</b> to the browser with Server-Sent Events instead of polling.
          </li>
          <li>
            <b>Silence-aware chunk boundaries</b> (ffmpeg <code>silencedetect</code>) so a word is never split between
            two chunks.
          </li>
          <li>
            <b>Partial results</b> on <code>PARTIAL_FAILURE</code>: keep the successful chunks and mark the gaps.
          </li>
          <li>
            <b>Real payments</b> (Razorpay checkout + webhook) instead of the demo upgrade button, and email
            verification / password reset for accounts.
          </li>
          <li>
            Alembic migrations instead of <code>create_all</code> plus a startup <code>ALTER TABLE</code>, speaker
            diarization, a reaper for rows stuck in a running state, and tests around transcript stitching.
          </li>
        </ul>
      </Card>

      <section>
        <p className="font-mono text-[11px] uppercase tracking-wider text-brand-600">Integration</p>
        <h2 className="mb-3 mt-1 text-xl font-bold">API requests</h2>
        <CodeBlock code={curl} label="bash" />
      </section>
    </article>
  );
}
