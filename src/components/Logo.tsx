/**
 * Torch brand mark: a flame emblem in a soft brand-tinted tile, optionally
 * followed by the lowercase "torch" wordmark. Rendered as inline SVG so it stays
 * crisp at any size and adapts to the current theme via semantic color tokens.
 */
export default function Logo({
  showWordmark = true,
  className = "",
}: {
  showWordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
        <FlameMark className="h-[18px] w-[18px]" />
      </span>
      {showWordmark && (
        <span className="font-display text-xl font-bold lowercase leading-none tracking-tight text-ink">
          torch
        </span>
      )}
    </span>
  );
}

export function FlameMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}
