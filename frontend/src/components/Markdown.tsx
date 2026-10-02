import type { ReactNode } from "react";

// Minimal renderer for the LLM summary (headings, bullet / numbered
// lists, **bold**). It builds React elements instead of using
// dangerouslySetInnerHTML, so model output can never inject HTML.

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

export default function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushList = () => {
    if (!list) return;
    const items = list.items.map((item, i) => <li key={i}>{inline(item)}</li>);
    blocks.push(
      list.ordered ? (
        <ol key={blocks.length} className="ml-5 list-decimal space-y-1">{items}</ol>
      ) : (
        <ul key={blocks.length} className="ml-5 list-disc space-y-1">{items}</ul>
      ),
    );
    list = null;
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)/);
    const numbered = line.match(/^\d+[.)]\s+(.*)/);
    const heading = line.match(/^#{1,6}\s+(.*)/);

    if (bullet || numbered) {
      const ordered = !bullet;
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }

    flushList();

    if (heading) {
      blocks.push(
        <h3 key={blocks.length} className="mt-4 font-semibold text-neutral-900">
          {inline(heading[1])}
        </h3>,
      );
    } else if (line) {
      blocks.push(<p key={blocks.length}>{inline(line)}</p>);
    }
  }
  flushList();

  return <div className="space-y-2 leading-relaxed text-neutral-700">{blocks}</div>;
}
