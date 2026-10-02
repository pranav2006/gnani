import UploadForm from "@/components/UploadForm";
import UploadList from "@/components/UploadList";
import Waveform from "@/components/Waveform";

export default function StudioHome() {
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-6 py-8 shadow-sm sm:px-8">
        <div className="relative z-10 max-w-xl">
          <p className="font-mono text-[11px] uppercase tracking-wider text-brand-600">Studio</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Turn recordings into notes</h1>
          <p className="mt-2 text-slate-600">
            Drop an audio file of any length to get a timestamped transcript from Gnani&apos;s speech recognition
            and an LLM summary.
          </p>
        </div>
        <div className="pointer-events-none absolute -right-4 top-1/2 hidden -translate-y-1/2 opacity-20 md:block">
          <Waveform bars={28} className="h-28" />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <UploadForm />
        </div>

        <UploadList />
      </div>
    </div>
  );
}
