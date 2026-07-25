import TokenViewToggle, { type TokenViewMode } from "../token/TokenViewToggle";

export type FeedViewMode = TokenViewMode;

interface FeedToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  viewMode: TokenViewMode;
  onViewModeChange: (mode: TokenViewMode) => void;
  resultCount: number;
  totalCount: number;
}

/** Search field + card/table view switch that sits above the live feed. */
export default function FeedToolbar({
  query,
  onQueryChange,
  viewMode,
  onViewModeChange,
  resultCount,
  totalCount,
}: FeedToolbarProps) {
  const filtering = query.trim().length > 0;

  return (
    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-dim" />
        <input
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search by name, symbol, address, or description…"
          aria-label="Search token profiles"
          className="w-full rounded-xl border border-line bg-card py-2.5 pl-9 pr-9 text-sm text-ink outline-none transition placeholder:text-ink-dim focus:border-accent focus:ring-2 focus:ring-accent/10"
        />
        {filtering && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-dim transition hover:bg-bg-soft hover:text-ink"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span className="text-xs text-ink-dim">
          {filtering ? (
            <>
              <span className="font-semibold text-ink">{resultCount}</span> of {totalCount}
            </>
          ) : (
            <>
              <span className="font-semibold text-ink">{totalCount}</span> tokens
            </>
          )}
        </span>

        <TokenViewToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />
      </div>
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}
