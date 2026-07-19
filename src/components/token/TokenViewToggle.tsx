export type TokenViewMode = "cards" | "table";

interface TokenViewToggleProps {
  viewMode: TokenViewMode;
  onViewModeChange: (mode: TokenViewMode) => void;
}

/** Cards / table switch, shared by the live feed and the watchlist. */
export default function TokenViewToggle({ viewMode, onViewModeChange }: TokenViewToggleProps) {
  return (
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
