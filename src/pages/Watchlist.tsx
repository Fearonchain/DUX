import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useWatchlist } from "../lib/watchlist";
import {
  fetchMarketPairsResilient,
  fetchTokenBriefs,
  type MarketPair,
  type TokenBrief,
} from "../lib/market";
import { shortenAddress } from "../lib/types";
import { DEFAULT_CHAIN_ID } from "../lib/chains";
import type { WatchedToken } from "../lib/watchlist";
import AlertForm from "../components/watchlist/AlertForm";
import AlertList from "../components/watchlist/AlertList";
import TokenCard from "../components/token/TokenCard";
import TokenList from "../components/token/TokenList";
import TokenViewToggle, { type TokenViewMode } from "../components/token/TokenViewToggle";
import { type TokenViewItem } from "../components/token/tokenView";

const REFRESH_MS = 15000;
const VIEW_STORAGE_KEY = "dux.watchlist.view";

function loadViewMode(): TokenViewMode {
  if (typeof window === "undefined") return "cards";
  return window.localStorage.getItem(VIEW_STORAGE_KEY) === "table" ? "table" : "cards";
}

/** Chain of a watched token, defaulting to Solana for legacy entries. */
function chainOf(token: WatchedToken): string {
  return token.chainId ?? DEFAULT_CHAIN_ID;
}

/** Stable per-token key, distinct across chains that share an address. */
function watchKey(chainId: string, address: string): string {
  return `${chainId}:${address}`;
}

/** Normalize a watched token + its live data into the shared token-view shape. */
function toTokenViewItem(
  address: string,
  chainId: string,
  market: MarketPair | null | undefined,
  brief: TokenBrief | undefined
): TokenViewItem {
  return { address, chainId, market, brief };
}

export default function Watchlist() {
  const {
    list_of_watched_tokens,
    list_of_alerts,
    clearTriggeredAlerts,
  } = useWatchlist();

  const [markets, setMarkets] = useState<Record<string, MarketPair | null>>({});
  const [briefs, setBriefs] = useState<Record<string, TokenBrief>>({});
  const [alertModalToken, setAlertModalToken] = useState<{ address: string; chainId: string } | null>(
    null
  );
  const [viewMode, setViewMode] = useState<TokenViewMode>(loadViewMode);
  const fetchedBriefs = useRef<Set<string>>(new Set());

  useEffect(() => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  // Group watched tokens by chain so each API call uses the right slug.
  const chainGroups = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const token of list_of_watched_tokens) {
      const chainId = chainOf(token);
      const list = groups.get(chainId) ?? [];
      list.push(token.address);
      groups.set(chainId, list);
    }
    return groups;
  }, [list_of_watched_tokens]);

  const watchKeyList = useMemo(
    () => list_of_watched_tokens.map((token) => watchKey(chainOf(token), token.address)).join(","),
    [list_of_watched_tokens]
  );

  // Poll live market data for every watched token, per chain.
  useEffect(() => {
    if (list_of_watched_tokens.length === 0) {
      setMarkets({});
      return;
    }
    let cancelled = false;

    async function loadMarkets() {
      const merged: Record<string, MarketPair | null> = {};
      await Promise.all(
        [...chainGroups.entries()].map(async ([chainId, addresses]) => {
          const map = await fetchMarketPairsResilient(addresses, chainId);
          for (const address of addresses) merged[watchKey(chainId, address)] = map[address] ?? null;
        })
      );
      if (!cancelled) setMarkets(merged);
    }

    loadMarkets();
    const interval = window.setInterval(loadMarkets, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchKeyList]);

  // Enrich watched tokens with names / symbols / logos (once per token), per chain.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const [chainId, addresses] of chainGroups) {
        const pending = addresses.filter(
          (address) => !fetchedBriefs.current.has(watchKey(chainId, address))
        );
        for (let i = 0; i < pending.length; i += 30) {
          const batch = pending.slice(i, i + 30);
          batch.forEach((address) => fetchedBriefs.current.add(watchKey(chainId, address)));
          const map = await fetchTokenBriefs(batch, chainId);
          if (cancelled) return;
          const keyed: Record<string, TokenBrief> = {};
          for (const address of batch) {
            const brief = map[address];
            if (brief) keyed[watchKey(chainId, address)] = brief;
          }
          setBriefs((prev) => ({ ...prev, ...keyed }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchKeyList]);

  const triggeredCount = list_of_alerts.filter((alert) => alert.triggeredAt !== null).length;
  const modalKey = alertModalToken ? watchKey(alertModalToken.chainId, alertModalToken.address) : null;
  const modalMarket = modalKey ? markets[modalKey] : null;
  const modalBrief = modalKey ? briefs[modalKey] : undefined;
  const modalPrice = modalMarket?.priceUsd ?? null;
  const modalMarketCap = modalMarket?.marketCap ?? null;
  const modalSymbol =
    modalBrief?.symbol?.trim() || modalMarket?.baseSymbol?.trim() || null;
  const modalName = modalBrief?.name?.trim() || modalMarket?.baseName?.trim() || null;
  const modalIcon = modalBrief?.imageUrl ?? modalMarket?.imageUrl ?? null;

  return (
    <div className="pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Watchlist</h1>
          <p className="mt-2 max-w-2xl text-ink-dim">
            Star tokens to track their live price here, and set alerts to get notified when they
            cross a target. Everything is stored in your browser.
          </p>
        </div>
        {list_of_watched_tokens.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-dim">
              <span className="font-semibold text-ink">{list_of_watched_tokens.length}</span> tokens
            </span>
            <TokenViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          </div>
        )}
      </div>

      {list_of_watched_tokens.length === 0 ? (
        <div className="mt-6 rounded-xl border border-line bg-card p-8 text-center">
          <p className="font-semibold text-ink">Your watchlist is empty</p>
          <p className="mt-1 text-sm text-ink-dim">
            Open a token and tap the star, or star tokens from the live feed.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link
              to="/feed"
              className="rounded-lg border border-line bg-bg-soft px-3 py-1.5 text-sm font-semibold text-ink transition hover:border-accent"
            >
              Browse live feed
            </Link>
            <Link
              to="/"
              className="rounded-lg border border-line bg-bg-soft px-3 py-1.5 text-sm font-semibold text-ink transition hover:border-accent"
            >
              Look up a token
            </Link>
          </div>
        </div>
      ) : viewMode === "cards" ? (
        <div className="mt-6 grid animate-fade-in gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list_of_watched_tokens.map((token) => {
            const chainId = chainOf(token);
            const key = watchKey(chainId, token.address);
            return (
              <TokenCard
                key={key}
                item={toTokenViewItem(token.address, chainId, markets[key], briefs[key])}
                footer={
                  <AddAlertButton
                    onAddAlert={() => setAlertModalToken({ address: token.address, chainId })}
                  />
                }
              />
            );
          })}
        </div>
      ) : (
        <div className="animate-fade-in">
          <TokenList
            list_of_items={list_of_watched_tokens.map((token) => {
              const chainId = chainOf(token);
              const key = watchKey(chainId, token.address);
              return toTokenViewItem(token.address, chainId, markets[key], briefs[key]);
            })}
            actionHeader="Alert"
            renderAction={(item) => (
              <AddAlertButton
                compact
                onAddAlert={() =>
                  setAlertModalToken({
                    address: item.address,
                    chainId: item.chainId ?? DEFAULT_CHAIN_ID,
                  })
                }
              />
            )}
          />
        </div>
      )}

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">
            Price alerts
            {list_of_alerts.length > 0 && (
              <span className="ml-2 text-sm font-normal text-ink-dim">
                {list_of_alerts.length}
              </span>
            )}
          </h2>
          {triggeredCount > 0 && (
            <button
              type="button"
              onClick={clearTriggeredAlerts}
              className="rounded-lg border border-line bg-bg-soft px-3 py-1.5 text-sm font-semibold text-ink-dim transition hover:border-accent hover:text-ink"
            >
              Clear {triggeredCount} triggered
            </button>
          )}
        </div>
        <div className="mt-4">
          <AlertList alerts={list_of_alerts} showToken briefs={briefs} />
        </div>
      </section>

      {alertModalToken && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setAlertModalToken(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Create price alert"
            className="w-full max-w-md animate-fade-in overflow-hidden rounded-2xl border border-line bg-card shadow-2xl shadow-black/25"
            onClick={(e) => e.stopPropagation()}
          >
            {/* header with token identity + subtle brand gradient */}
            <div className="relative flex items-center gap-3 border-b border-line bg-gradient-to-br from-brand-soft/60 to-transparent p-5">
              {modalIcon ? (
                <img
                  src={modalIcon}
                  alt=""
                  className="h-11 w-11 rounded-xl bg-bg-soft object-cover ring-1 ring-line"
                />
              ) : (
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-bg-soft font-mono text-sm font-bold text-ink-dim ring-1 ring-line">
                  {(modalSymbol ?? "").slice(0, 2).toUpperCase() || "?"}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">
                  New price alert
                </p>
                <h3 className="truncate text-lg font-bold leading-tight text-ink">
                  {modalSymbol || shortenAddress(alertModalToken.address)}
                </h3>
                {modalName && modalName !== modalSymbol && (
                  <p className="truncate text-xs text-ink-dim">{modalName}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setAlertModalToken(null)}
                aria-label="Close"
                className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-ink-dim transition hover:bg-bg-soft hover:text-ink"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="p-5">
              <AlertForm
                address={alertModalToken.address}
                chainId={alertModalToken.chainId}
                currentPrice={modalPrice}
                currentMarketCap={modalMarketCap}
                onCreated={() => setAlertModalToken(null)}
              />
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-dim">
                <BellIcon className="h-3 w-3" />
                Alerts run while Torch is open and notify you in-app and via your browser.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** "Add price alert" trigger used inside both the card footer and list rows. */
function AddAlertButton({
  onAddAlert,
  compact = false,
}: {
  onAddAlert: () => void;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <button
        type="button"
        onClick={onAddAlert}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg-soft px-2.5 py-1.5 text-xs font-semibold text-ink-dim transition hover:border-brand hover:text-brand"
      >
        <BellIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Alert</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onAddAlert}
      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-line bg-bg-soft px-3 py-2 text-xs font-semibold text-ink-dim transition hover:border-brand hover:text-brand"
    >
      <BellIcon className="h-3.5 w-3.5" />
      Add price alert
    </button>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
