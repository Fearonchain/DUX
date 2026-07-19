export type FeedViewMode = "cards" | "table";

interface FeedToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  viewMode: FeedViewMode;
  onViewModeChange: (mode: FeedViewMode) => void;
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

        <div
          role="tablist"
          aria-label="View mode"
          className="inline-flex rounded-xl border border-line bg-bg-soft p-1"
        >
          <ToggleButton
            active={viewMode === "cards"}
            onClick={() => onViewModeChange("cards")}
            label="Card view"
          >
            <CardsIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Cards</span>
          </ToggleButton>
          <ToggleButton
            active={viewMode === "table"}
            onClick={() => onViewModeChange("table")}
            label="Table view"
          >
            <TableIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Table</span>
          </ToggleButton>
        </div>
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={label}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
        active ? "bg-card text-ink shadow-sm" : "text-ink-dim hover:text-ink"
      }`}
    >
      {children}
    </button>
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

function CardsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function TableIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  );
}
