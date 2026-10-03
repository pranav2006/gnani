const HEIGHTS = [0.45, 0.8, 0.6, 1, 0.7, 0.9, 0.5, 0.75, 0.55, 0.95, 0.65, 0.4];

export default function Waveform({
  active = true,
  bars = 12,
  className = "h-8",
  color = "bg-brand-600",
}: {
  active?: boolean;
  bars?: number;
  className?: string;
  color?: string;
}) {
  return (
    <div className={`flex items-center gap-[3px] ${className}`} aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          className={`h-full w-[3px] origin-center rounded-full ${color} ${active ? "animate-eq" : ""}`}
          style={{
            transform: active ? undefined : `scaleY(${HEIGHTS[i % HEIGHTS.length]})`,
            animationDelay: `${(i * 0.09) % 0.9}s`,
          }}
        />
      ))}
    </div>
  );
}
