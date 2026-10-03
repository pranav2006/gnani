type Box = {
  x: number;
  y: number;
  title: string;
  sub: string;
  tone: "light" | "dark" | "external";
};

const W = 200;
const H = 96;

const BOXES: Box[] = [
  { x: 30, y: 282, title: "Browser", sub: "Next.js on Vercel", tone: "light" },
  { x: 320, y: 282, title: "API", sub: "FastAPI on Railway", tone: "dark" },
  { x: 625, y: 90, title: "Storage bucket", sub: "original audio files", tone: "light" },
  { x: 625, y: 282, title: "Postgres", sub: "status, transcript, summary", tone: "light" },
  { x: 625, y: 474, title: "Redis queue", sub: "jobs waiting to run", tone: "light" },
  { x: 930, y: 282, title: "Worker", sub: "Celery + ffmpeg", tone: "dark" },
  { x: 930, y: 90, title: "Gnani ASR", sub: "speech to text", tone: "external" },
  { x: 930, y: 474, title: "Groq LLM", sub: "writes the summary", tone: "external" },
];

type Arrow = { d: string; label: string; lx: number; ly: number; anchor?: "start" | "middle" | "end" };

const ARROWS: Arrow[] = [
  { d: "M230 312 L320 312", label: "upload", lx: 275, ly: 302 },
  { d: "M320 348 L230 348", label: "progress", lx: 275, ly: 370 },
  { d: "M520 300 L625 150", label: "save audio", lx: 562, ly: 214, anchor: "end" },
  { d: "M520 330 L625 330", label: "create row", lx: 572, ly: 320 },
  { d: "M520 360 L625 510", label: "queue job", lx: 562, ly: 450, anchor: "end" },
  { d: "M825 510 L930 360", label: "picks up job", lx: 888, ly: 450, anchor: "start" },
  { d: "M930 300 L825 150", label: "fetch audio", lx: 888, ly: 214, anchor: "start" },
  { d: "M930 330 L825 330", label: "progress", lx: 878, ly: 320 },
  { d: "M1030 282 L1030 186", label: "10-min chunks", lx: 1042, ly: 238, anchor: "start" },
  { d: "M1030 378 L1030 474", label: "transcript", lx: 1042, ly: 430, anchor: "start" },
];

const TONES = {
  light: { fill: "#ffffff", stroke: "#e5e5e5", title: "#0a0a0a", sub: "#737373" },
  dark: { fill: "#0a0a0a", stroke: "#0a0a0a", title: "#ffffff", sub: "#f87171" },
  external: { fill: "#fef2f2", stroke: "#fecaca", title: "#b91c1c", sub: "#dc2626" },
};

export default function ArchitectureDiagram() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm sm:p-6">
      <svg
        viewBox="0 0 1180 600"
        role="img"
        aria-label="Architecture diagram: the browser uploads to the API, which saves the audio to the storage bucket, creates a row in Postgres and queues a job in Redis. The worker picks up the job, fetches the audio, sends 10-minute chunks to Gnani for transcription, sends the transcript to Groq for a summary, and saves progress to Postgres, which the browser shows live."
        className="h-auto w-full min-w-[720px] font-sans"
      >
        <defs>
          <marker id="arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="#dc2626" />
          </marker>
          <style>{`
            .flow { stroke-dasharray: 6 6; animation: flow 1.2s linear infinite; }
            @keyframes flow { to { stroke-dashoffset: -12; } }
          `}</style>
        </defs>

        <text x="30" y="40" fontSize="13" fontWeight="600" fill="#dc2626" letterSpacing="2" className="font-mono">
          HOW AN UPLOAD FLOWS
        </text>
        <g fontSize="12" fill="#737373">
          <rect x="760" y="28" width="14" height="14" rx="4" fill="#0a0a0a" />
          <text x="782" y="40">our code</text>
          <rect x="860" y="28" width="14" height="14" rx="4" fill="#ffffff" stroke="#e5e5e5" />
          <text x="882" y="40">storage</text>
          <rect x="955" y="28" width="14" height="14" rx="4" fill="#fef2f2" stroke="#fecaca" />
          <text x="977" y="40">outside services</text>
        </g>

        {ARROWS.map((arrow) => (
          <g key={arrow.d}>
            <path d={arrow.d} stroke="#dc2626" strokeWidth="2" fill="none" markerEnd="url(#arrowhead)" className="flow" />
            <text
              x={arrow.lx}
              y={arrow.ly}
              fontSize="12.5"
              fill="#525252"
              textAnchor={arrow.anchor ?? "middle"}
              className="font-mono"
            >
              {arrow.label}
            </text>
          </g>
        ))}

        {BOXES.map((box) => {
          const tone = TONES[box.tone];
          return (
            <g key={box.title}>
              <rect
                x={box.x}
                y={box.y}
                width={W}
                height={H}
                rx="16"
                fill={tone.fill}
                stroke={tone.stroke}
                strokeWidth="1.5"
                strokeDasharray={box.tone === "external" ? "5 4" : undefined}
              />
              <text x={box.x + W / 2} y={box.y + 44} textAnchor="middle" fontSize="18" fontWeight="700" fill={tone.title}>
                {box.title}
              </text>
              <text x={box.x + W / 2} y={box.y + 68} textAnchor="middle" fontSize="12.5" fill={tone.sub}>
                {box.sub}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
