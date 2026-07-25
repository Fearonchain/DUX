import { useEffect, useState } from "react";
import CommandPalette from "./CommandPalette";

/** True when the user is typing into a field, so shortcuts don't hijack input. */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/**
 * Platform-wide token search that lives in the site header on every page.
 *
 * Renders a search trigger (a full "search tokens" bar on desktop, a compact
 * icon button on mobile) and owns the open/closed state of the command palette.
 * Openable from anywhere with ⌘K / Ctrl-K, or by pressing "/" while not already
 * typing in a field.
 */
export default function GlobalSearch() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "/" && !open && !isTypingTarget(e.target)) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      {/* Desktop: full search bar. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search tokens"
        className="hidden w-full max-w-sm items-center gap-2 rounded-xl border border-line bg-bg-soft px-3 py-2 text-sm text-ink-dim transition hover:border-accent hover:text-ink sm:flex"
      >
        <SearchIcon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Search tokens…</span>
        <kbd className="rounded border border-line bg-card px-1.5 py-0.5 font-mono text-[10px] text-ink-dim">
          ⌘K
        </kbd>
      </button>

      {/* Mobile: compact icon button. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search tokens"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-bg-soft text-ink-dim transition hover:border-accent hover:text-ink sm:hidden"
      >
        <SearchIcon className="h-4 w-4" />
      </button>

      {open && <CommandPalette onClose={() => setOpen(false)} />}
    </>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}
