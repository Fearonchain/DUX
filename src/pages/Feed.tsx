import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "../lib/config";
import { relTime, type TokenProfile } from "../lib/types";
import { fetchMarketPairs, fetchTokenBriefs, type MarketPair, type TokenBrief } from "../lib/market";
import FeedToolbar from "../components/feed/FeedToolbar";
import FeedSkeleton from "../components/feed/FeedSkeleton";
import TokenCard from "../components/token/TokenCard";
import TokenList from "../components/token/TokenList";
import { type TokenViewMode } from "../components/token/TokenViewToggle";
import { type TokenViewItem } from "../components/token/tokenView";

const POLL_MS = 5000;
const VIEW_STORAGE_KEY = "dux.feed.view";

function loadViewMode(): TokenViewMode {
  if (typeof window === "undefined") return "cards";
  return window.localStorage.getItem(VIEW_STORAGE_KEY) === "table" ? "table" : "cards";
}

/** Normalize a profile + its live data into the shared token-view shape. */
function toTokenViewItem(
  profile: TokenProfile,
  market: MarketPair | null | undefined,
  brief: TokenBrief | undefined,
  isFresh: boolean
): TokenViewItem {
  return {
    address: profile.tokenAddress,
    market,
    brief,
    headerImageUrl: profile.header,
    iconFallback: profile.icon,
    description: profile.description,
    list_of_links: profile.links,
    updatedAt: profile.updatedAt,
    isFresh,
  };
}

/** Does a profile match the search query across name, symbol, address, etc.? */
function matchesQuery(
  profile: TokenProfile,
  brief: TokenBrief | undefined,
  needle: string
): boolean {
  const haystack = [
    brief?.name,
    brief?.symbol,
    profile.tokenAddress,
    profile.description,
    ...profile.links.map((l) => l.label || l.type),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

export default function Feed() {
  const [profiles, setProfiles] = useState<TokenProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [, forceTick] = useState(0);
  const [markets, setMarkets] = useState<Record<string, MarketPair | null>>({});
  const [briefs, setBriefs] = useState<Record<string, TokenBrief>>({});
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<TokenViewMode>(loadViewMode);
  const known = useRef<Map<string, string>>(new Map());
  const first = useRef(true);
  const fetchedMarkets = useRef<Set<string>>(new Set());
  const fetchedBriefs = useRef<Set<string>>(new Set());

  useEffect(() => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    let stop = false;

    async function poll() {
      try {
        const res = await fetch(`${API_BASE}/token-profiles/recent-updates/v1`, { cache: "no-store" });
        if (!res.ok || stop) return;
        const data: TokenProfile[] = await res.json();

        const changed = new Set<string>();
        if (!first.current) {
          for (const p of data) {
            if (known.current.get(p.tokenAddress) !== p.updatedAt) changed.add(p.tokenAddress);
          }
        }
        first.current = false;
        known.current = new Map(data.map((p) => [p.tokenAddress, p.updatedAt]));

        setProfiles(data);
        setLastFetch(new Date());
        if (changed.size > 0) {
          setFresh(changed);
          setTimeout(() => setFresh(new Set()), 4000);
        }
      } catch {
        /* transient error, next poll retries */
      } finally {
        if (!stop) setLoading(false);
      }
    }

    poll();
    const iv = setInterval(poll, POLL_MS);
    const tick = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => {
      stop = true;
      clearInterval(iv);
      clearInterval(tick);
    };
  }, []);

  // Lazily pull live market data for the feed in batched requests (up to 30
  // tokens per Dexscreener call) rather than one request per token, so a full
  // page of charts resolves in a couple of requests instead of dozens.
  useEffect(() => {
    let cancelled = false;
    const pending = profiles
      .map((p) => p.tokenAddress)
      .filter((addr) => !fetchedMarkets.current.has(addr));
    if (pending.length === 0) return;

    pending.forEach((addr) => fetchedMarkets.current.add(addr));
    (async () => {
      const map = await fetchMarketPairs(pending);
      if (cancelled) return;
      setMarkets((m) => ({ ...m, ...map }));
    })();
    return () => {
      cancelled = true;
    };
  }, [profiles]);

  // Enrich profiles with real names / symbols / logos (batched, once per token).
  // Powers both the search index and the richer card/table labels.
  useEffect(() => {
    let cancelled = false;
    const pending = profiles
      .map((p) => p.tokenAddress)
      .filter((addr) => !fetchedBriefs.current.has(addr));
    if (pending.length === 0) return;

    (async () => {
      for (let i = 0; i < pending.length; i += 30) {
        const batch = pending.slice(i, i + 30);
        batch.forEach((addr) => fetchedBriefs.current.add(addr));
        const map = await fetchTokenBriefs(batch);
        if (cancelled) return;
        setBriefs((prev) => ({ ...prev, ...map }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profiles]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return profiles;
    return profiles.filter((p) => matchesQuery(p, briefs[p.tokenAddress], needle));
  }, [profiles, briefs, query]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-3xl font-bold">Live Feed</h1>
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-bg-soft px-3 py-1 text-xs font-bold text-accent">
          <span className="h-2 w-2 animate-pulse-dot rounded-full bg-accent" /> LIVE
          {lastFetch && (
            <span className="font-normal text-ink-dim">
              · updated {relTime(lastFetch.toISOString())}
            </span>
          )}
        </span>
      </div>
      <p className="mt-2 text-ink-dim">
        Token profiles that were just updated, newest first. Refreshes automatically every
        5&nbsp;seconds.
      </p>

      {profiles.length > 0 && (
        <FeedToolbar
          query={query}
          onQueryChange={setQuery}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          resultCount={filtered.length}
          totalCount={profiles.length}
        />
      )}

      {loading && profiles.length === 0 ? (
        <FeedSkeleton viewMode={viewMode} />
      ) : profiles.length === 0 ? (
        <div className="mt-5 rounded-xl border border-line bg-card p-5 text-center text-ink-dim">
          No updates yet. As soon as someone updates their token info, it shows up here.
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-5 rounded-xl border border-line bg-card p-8 text-center">
          <p className="font-semibold text-ink">No matches for “{query.trim()}”</p>
          <p className="mt-1 text-sm text-ink-dim">
            Try a token name, symbol, or address.
          </p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="mt-4 rounded-lg border border-line bg-bg-soft px-3 py-1.5 text-sm font-semibold text-ink transition hover:border-accent"
          >
            Clear search
          </button>
        </div>
      ) : viewMode === "cards" ? (
        <div className="mt-5 grid animate-fade-in gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <TokenCard
              key={p.tokenAddress}
              item={toTokenViewItem(
                p,
                markets[p.tokenAddress],
                briefs[p.tokenAddress],
                fresh.has(p.tokenAddress)
              )}
            />
          ))}
        </div>
      ) : (
        <TokenList
          list_of_items={filtered.map((p) =>
            toTokenViewItem(
              p,
              markets[p.tokenAddress],
              briefs[p.tokenAddress],
              fresh.has(p.tokenAddress)
            )
          )}
          showProfileColumns
          showUpdatedColumn
        />
      )}
    </div>
  );
}
