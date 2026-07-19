interface SkeletonProps {
  /** Extra classes for sizing / shape (e.g. "h-4 w-24 rounded-full"). */
  className?: string;
}

/**
 * A single shimmering placeholder block. Compose several of these to mock the
 * shape of the content that is still loading. Colors track the light theme so
 * the sweep stays subtle rather than flashy.
 */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-shimmer rounded bg-[linear-gradient(90deg,#ececf0_8%,#f6f7f8_18%,#ececf0_33%)] bg-[length:200%_100%] ${className}`}
    />
  );
}

interface SpinnerProps {
  /** Sizing classes for the SVG (default "h-5 w-5"). */
  className?: string;
  /** Optional text shown next to the spinner. */
  label?: string;
}

/**
 * Lightweight indeterminate spinner for inline / button loading states.
 * Inherits `currentColor`, so wrap it in a colored element to tint it.
 */
export function Spinner({ className = "h-5 w-5", label }: SpinnerProps) {
  return (
    <span role="status" className="inline-flex items-center gap-2">
      <svg
        className={`animate-spin ${className}`}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          className="opacity-90"
        />
      </svg>
      {label && <span className="text-sm">{label}</span>}
    </span>
  );
}
