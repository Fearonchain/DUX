import { useWatchlist } from "../lib/watchlist";
import { DEFAULT_CHAIN_ID } from "../lib/chains";

interface WatchButtonProps {
  address: string;
  /** Chain the token lives on. Defaults to Solana for legacy call sites. */
  chainId?: string;
  /** Compact icon-only button (for cards); otherwise shows a label too. */
  compact?: boolean;
  className?: string;
}

/**
 * Star toggle that adds/removes a token from the watchlist. Safe to nest inside
 * a router <Link> (it stops the click from bubbling into navigation).
 */
export default function WatchButton({
  address,
  chainId = DEFAULT_CHAIN_ID,
  compact = false,
  className = "",
}: WatchButtonProps) {
  const { isWatched, toggleWatchlist } = useWatchlist();
  const watched = isWatched(address);
  const label = watched ? "Remove from watchlist" : "Add to watchlist";

  function handleClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    toggleWatchlist(address, chainId);
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={label}
        aria-pressed={watched}
        title={label}
        className={`grid h-8 w-8 place-items-center rounded-lg border backdrop-blur transition ${
          watched
            ? "border-brand/50 bg-brand-soft text-brand"
            : "border-line bg-card/80 text-ink-dim hover:border-accent hover:text-ink"
        } ${className}`}
      >
        <StarIcon filled={watched} className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      aria-pressed={watched}
      title={label}
      className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
        watched
          ? "border-brand/50 bg-brand-soft text-brand"
          : "border-line bg-card text-ink hover:border-accent"
      } ${className}`}
    >
      <StarIcon filled={watched} className="h-4 w-4" />
      {watched ? "Watching" : "Watch"}
    </button>
  );
}

function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2.5l2.9 6.06 6.6.86-4.86 4.53 1.24 6.55L12 17.9l-5.88 3.06 1.24-6.55L2.5 9.42l6.6-.86L12 2.5z" />
    </svg>
  );
}
