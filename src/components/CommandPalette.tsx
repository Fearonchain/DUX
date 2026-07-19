import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  searchTokens,
  formatPriceUsd,
  formatPercent,
  formatUsdCompact,
  type TokenSearchResult,
} from "../lib/market";
import { fetchDuxProfileStatuses, type DuxProfileStatus } from "../lib/profiles";
import { relTime, shortenAddress } from "../lib/types";
import { Spinner } from "./ui/Skeleton";

const SEARCH_DEBOUNCE_MS = 250;
const RECENTS_KEY = "dux.search.recents";
const MAX_RECENTS = 6;

/** A token the searcher opened before, remembered so it is one keystroke away. */
interface RecentToken {
  address: string;
  name: string;
  symbol: string;
  imageUrl: string | null;
}

function loadRecents(): RecentToken[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
}

function rememberRecent(token: RecentToken) {
  if (typeof window === "undefined") return;
  const next = [token, ...loadRecents().filter((t) => t.address !== token.address)].slice(
    0,
    MAX_RECENTS
  );
  window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
}

interface CommandPaletteProps {
  onClose: () => void;
}

/**
 * Platform-wide token finder. Opens over any page, searches every Solana token
 * via Dexscreener, shows each token's logo, live price and — the DUX-specific
 * bit — whether that token already carries verified enhanced info. Fully
 * keyboard-drivable: type to search, arrows to move, Enter to open, Esc to close.
 */
export default function CommandPalette({ onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TokenSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [duxByAddress, setDuxByAddress] = useState<Record<string, DuxProfileStatus>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [recents] = useState<RecentToken[]>(loadRecents);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const duxRequested = useRef<Set<string>>(new Set());

  const trimmed = query.trim();
  const searching = trimmed.length >= 2;

  // Lock background scroll while the palette owns the screen.
  useEffect(() => {
    inputRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Debounced token search. A monotonically increasing request id guards against
  // out-of-order responses overwriting a newer query's results.
  useEffect(() => {
    if (!searching) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = await searchTokens(trimmed);
      if (cancelled) return;
      setResults(found);
      setActiveIndex(0);
      setLoading(false);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, searching]);

  // Once results land, ask the DUX API which of them already carry enhanced info.
  useEffect(() => {
    const pending = results.map((r) => r.address).filter((a) => !duxRequested.current.has(a));
    if (pending.length === 0) return;
    pending.forEach((a) => duxRequested.current.add(a));
    (async () => {
      const map = await fetchDuxProfileStatuses(pending);
      setDuxByAddress((prev) => ({ ...prev, ...map }));
    })();
  }, [results]);

  const items = useMemo(
    () =>
      searching
        ? results
        : recents.map<TokenSearchResult>((r) => ({
            ...r,
            priceUsd: 0,
            priceChange24h: 0,
            liquidityUsd: 0,
            marketCap: 0,
          })),
    [searching, results, recents]
  );

  function openToken(token: TokenSearchResult) {
    rememberRecent({
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      imageUrl: token.imageUrl,
    });
    onClose();
    navigate(`/token/${token.address}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (items.length ? (i + 1) % items.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const token = items[activeIndex];
      if (token) openToken(token);
    }
  }

  // Keep the highlighted row visible as the user arrows through the list.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 px-4 pt-[12vh] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Search tokens"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-card shadow-2xl animate-fade-in"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {/* search input */}
        <div className="flex items-center gap-3 border-b border-line px-4">
          <SearchIcon className="h-5 w-5 shrink-0 text-ink-dim" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any Solana token by name, symbol or address…"
            aria-label="Search any Solana token"
            className="w-full bg-transparent py-4 text-[15px] text-ink outline-none placeholder:text-ink-dim"
          />
          {loading && <Spinner className="h-4 w-4 shrink-0 text-ink-dim" />}
          <kbd className="hidden shrink-0 rounded border border-line bg-bg-soft px-1.5 py-0.5 font-mono text-[10px] text-ink-dim sm:block">
            esc
          </kbd>
        </div>

        {/* results */}
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {!searching && items.length > 0 && (
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-dim">
              Recent
            </p>
          )}

          {searching && !loading && results.length === 0 ? (
            <div className="px-3 py-10 text-center">
              <p className="font-semibold text-ink">No tokens found for “{trimmed}”</p>
              <p className="mt-1 text-sm text-ink-dim">
                Try a different name, ticker, or paste a mint address.
              </p>
            </div>
          ) : !searching && items.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-ink-dim">
              Start typing to search every token on Solana.
            </div>
          ) : (
            items.map((token, index) => (
              <ResultRow
                key={token.address}
                index={index}
                token={token}
                dux={duxByAddress[token.address]}
                showMarket={searching}
                active={index === activeIndex}
                onHover={() => setActiveIndex(index)}
                onSelect={() => openToken(token)}
              />
            ))
          )}
        </div>

        {/* footer legend */}
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2 text-[11px] text-ink-dim">
          <span className="flex items-center gap-3">
            <LegendKey label="↑↓" text="navigate" />
            <LegendKey label="↵" text="open" />
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-brand" />
            has DUX enhanced info
          </span>
        </div>
      </div>
    </div>
  );
}

function ResultRow({
  index,
  token,
  dux,
  showMarket,
  active,
  onHover,
  onSelect,
}: {
  index: number;
  token: TokenSearchResult;
  dux: DuxProfileStatus | undefined;
  showMarket: boolean;
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  const label = token.name || token.symbol || shortenAddress(token.address);
  const monogram = (token.name || token.symbol || token.address).slice(0, 2).toUpperCase();
  const changePositive = token.priceChange24h >= 0;

  return (
    <button
      type="button"
      data-index={index}
      onMouseMove={onHover}
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
        active ? "bg-bg-soft" : "hover:bg-bg-soft/60"
      }`}
    >
      {token.imageUrl ? (
        <img
          src={token.imageUrl}
          alt=""
          loading="lazy"
          className="h-9 w-9 shrink-0 rounded-full bg-bg-soft object-cover"
        />
      ) : (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft font-mono text-[11px] font-bold text-brand">
          {monogram}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-ink">{label}</span>
          {token.symbol && token.name && (
            <span className="shrink-0 font-mono text-[11px] uppercase text-ink-dim">
              {token.symbol}
            </span>
          )}
          <DuxBadge dux={dux} />
        </div>
        <p className="truncate font-mono text-[11px] text-ink-dim">
          {shortenAddress(token.address)}
        </p>
      </div>

      {showMarket && token.priceUsd > 0 && (
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-ink">{formatPriceUsd(token.priceUsd)}</p>
          <p className={`text-[11px] font-semibold ${changePositive ? "text-up" : "text-down"}`}>
            {formatPercent(token.priceChange24h)}
            {token.liquidityUsd > 0 && (
              <span className="ml-1.5 font-normal text-ink-dim">
                {formatUsdCompact(token.liquidityUsd)} liq
              </span>
            )}
          </p>
        </div>
      )}
    </button>
  );
}

/** Small pill signalling whether the token carries verified DUX enhanced info. */
function DuxBadge({ dux }: { dux: DuxProfileStatus | undefined }) {
  if (dux === undefined) {
    return <span className="h-4 w-10 shrink-0 animate-pulse rounded-full bg-bg-soft" />;
  }
  if (!dux.hasProfile) {
    return (
      <span className="shrink-0 rounded-full border border-line px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-dim">
        No DUX
      </span>
    );
  }
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand"
      title={dux.updatedAt ? `Enhanced info updated ${relTime(dux.updatedAt)}` : "Has DUX enhanced info"}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" />
      DUX
      {dux.updatedAt && <span className="font-medium normal-case">· {relTime(dux.updatedAt)}</span>}
    </span>
  );
}

function LegendKey({ label, text }: { label: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <kbd className="rounded border border-line bg-bg-soft px-1.5 py-0.5 font-mono text-[10px] text-ink-dim">
        {label}
      </kbd>
      {text}
    </span>
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
