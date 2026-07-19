import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet, WalletButton } from "../components/WalletProviders";
import {
  formatTokenAmount,
  loadWalletPortfolio,
  type PortfolioHolding,
  type WalletPortfolio,
} from "../lib/portfolio";
import { formatPriceUsd, relTimeShort, sparkPointsFromPair } from "../lib/market";
import { shortenAddress } from "../lib/types";
import { PriceChangeBadge, TokenAvatar } from "../components/token/tokenView";
import Sparkline from "../components/token/Sparkline";

const REFRESH_MS = 30000;
const DUST_THRESHOLD_USD = 1;

/** Base58, 32–44 chars — a cheap client-side sanity check for an address. */
const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
function isLikelyAddress(value: string): boolean {
  return SOLANA_ADDRESS_RE.test(value.trim());
}

/** A stable, colorful hue per mint for the allocation bar segments. */
function hueFromMint(mint: string): number {
  let hash = 0;
  for (let i = 0; i < mint.length; i += 1) hash = (hash * 31 + mint.charCodeAt(i)) % 360;
  return hash;
}

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function Portfolio() {
  const { address, connected } = useWallet();

  // A manually entered address takes precedence over the connected wallet, so
  // anyone can inspect any wallet without connecting one of their own.
  const [manualAddress, setManualAddress] = useState<string | null>(null);
  const [addressInput, setAddressInput] = useState("");

  const [portfolio, setPortfolio] = useState<WalletPortfolio | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [hideDust, setHideDust] = useState(true);
  const requestId = useRef(0);

  const activeAddress = manualAddress ?? address;
  const isViewingManual = manualAddress !== null && manualAddress !== address;

  const refresh = useCallback(
    async (walletAddress: string, showSpinner: boolean) => {
      const id = ++requestId.current;
      if (showSpinner) setLoading(true);
      setError(null);
      try {
        const result = await loadWalletPortfolio(walletAddress);
        if (id !== requestId.current) return;
        setPortfolio(result);
        setLastUpdated(Date.now());
      } catch {
        if (id !== requestId.current) return;
        setError("Couldn't load this wallet's balances. The data source may be busy — try again.");
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    []
  );

  // Load + poll whenever the wallet being viewed changes.
  useEffect(() => {
    if (!activeAddress) {
      setPortfolio(null);
      setLastUpdated(null);
      return;
    }
    setPortfolio(null);
    refresh(activeAddress, true);
    const interval = window.setInterval(() => refresh(activeAddress, false), REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [activeAddress, refresh]);

  const submitAddress = useCallback(() => {
    const trimmed = addressInput.trim();
    if (!isLikelyAddress(trimmed)) return;
    setManualAddress(trimmed);
  }, [addressInput]);

  const viewConnectedWallet = useCallback(() => {
    setManualAddress(null);
    setAddressInput("");
  }, []);

  const visibleHoldings = useMemo(() => {
    if (!portfolio) return [];
    const trimmed = query.trim().toLowerCase();
    return portfolio.list_of_holdings.filter((holding) => {
      if (hideDust && holding.valueUsd < DUST_THRESHOLD_USD) return false;
      if (!trimmed) return true;
      return (
        holding.symbol.toLowerCase().includes(trimmed) ||
        holding.name.toLowerCase().includes(trimmed) ||
        holding.mint.toLowerCase().includes(trimmed)
      );
    });
  }, [portfolio, query, hideDust]);

  const hiddenDustCount = useMemo(() => {
    if (!portfolio || !hideDust) return 0;
    return portfolio.list_of_holdings.filter((holding) => holding.valueUsd < DUST_THRESHOLD_USD)
      .length;
  }, [portfolio, hideDust]);

  return (
    <div className="pb-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Portfolio</h1>
          <p className="mt-2 max-w-2xl text-ink-dim">
            A clean, live snapshot of everything a wallet holds — net worth, every token, and how
            each position is moving. Connect your wallet or paste any address. Read-only; nothing is
            ever signed or sent.
          </p>
        </div>
        {activeAddress && (
          <button
            type="button"
            onClick={() => refresh(activeAddress, true)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg-soft px-3 py-1.5 text-sm font-semibold text-ink-dim transition hover:border-accent hover:text-ink disabled:opacity-50"
          >
            <RefreshIcon className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        )}
      </div>

      <AddressBar
        value={addressInput}
        onChange={setAddressInput}
        onSubmit={submitAddress}
        connected={connected}
        isViewingManual={isViewingManual}
        viewedAddress={activeAddress}
        onViewConnected={viewConnectedWallet}
      />

      {!activeAddress ? (
        <ConnectPrompt />
      ) : loading && !portfolio ? (
        <PortfolioSkeleton />
      ) : error && !portfolio ? (
        <ErrorState message={error} onRetry={() => activeAddress && refresh(activeAddress, true)} />
      ) : portfolio ? (
        <>
          <div className="mt-6 grid animate-fade-in gap-4 lg:grid-cols-5">
            <NetWorthCard portfolio={portfolio} lastUpdated={lastUpdated} />
            <AllocationCard portfolio={portfolio} />
          </div>

          <section className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold">
                Holdings
                <span className="ml-2 text-sm font-normal text-ink-dim">
                  {portfolio.pricedCount}
                </span>
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-dim" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Filter tokens"
                    className="w-44 rounded-lg border border-line bg-bg-soft py-1.5 pl-8 pr-3 text-sm text-ink outline-none transition placeholder:text-ink-dim focus:border-accent"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setHideDust((value) => !value)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                    hideDust
                      ? "border-accent bg-brand-soft text-brand"
                      : "border-line bg-bg-soft text-ink-dim hover:text-ink"
                  }`}
                >
                  Hide dust
                </button>
              </div>
            </div>

            {visibleHoldings.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-line bg-card p-8 text-center text-sm text-ink-dim">
                {portfolio.list_of_holdings.length === 0
                  ? "This wallet doesn't hold any tokens yet."
                  : "No holdings match your filter."}
              </div>
            ) : (
              <HoldingsTable holdings={visibleHoldings} />
            )}

            {hiddenDustCount > 0 && (
              <p className="mt-3 text-center text-xs text-ink-dim">
                {hiddenDustCount} low-value {hiddenDustCount === 1 ? "token" : "tokens"} hidden ·{" "}
                <button
                  type="button"
                  onClick={() => setHideDust(false)}
                  className="font-semibold text-brand hover:underline"
                >
                  show all
                </button>
              </p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function NetWorthCard({
  portfolio,
  lastUpdated,
}: {
  portfolio: WalletPortfolio;
  lastUpdated: number | null;
}) {
  const isUp = portfolio.change24hUsd >= 0;
  const solEquivalent =
    portfolio.solPriceUsd > 0 ? portfolio.totalUsd / portfolio.solPriceUsd : 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-brand-soft/50 to-transparent p-6 lg:col-span-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-dim">Net worth</p>
      <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
        <span className="text-4xl font-bold tracking-tight text-ink">
          <span className="text-ink-dim">$</span>
          {formatMoney(portfolio.totalUsd)}
        </span>
        {solEquivalent > 0 && (
          <span className="pb-1 text-sm text-ink-dim">
            ◎ {solEquivalent.toLocaleString("en-US", { maximumFractionDigits: 2 })} SOL
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2 text-sm">
        <PriceChangeBadge value={portfolio.change24hPct} showTimeframeLabel={false} />
        <span className={isUp ? "text-up" : "text-down"}>
          {isUp ? "+" : "−"}${formatMoney(Math.abs(portfolio.change24hUsd))}
        </span>
        <span className="text-ink-dim">24h</span>
      </div>
      <div className="mt-6 flex items-center gap-2 text-xs text-ink-dim">
        <span className="font-mono">{shortenAddress(portfolio.address)}</span>
        {lastUpdated && (
          <>
            <span aria-hidden>·</span>
            <span>updated {relTimeShort(Math.floor(lastUpdated / 1000))} ago</span>
          </>
        )}
      </div>
    </div>
  );
}

function AllocationCard({ portfolio }: { portfolio: WalletPortfolio }) {
  // Collapse everything past the top slices into a single "Others" bucket.
  const priced = portfolio.list_of_holdings.filter((holding) => holding.valueUsd > 0);
  const top = priced.slice(0, 6);
  const rest = priced.slice(6);
  const othersPct = rest.reduce((sum, holding) => sum + holding.allocationPct, 0);

  const segments = [
    ...top.map((holding) => ({
      key: holding.mint,
      label: holding.symbol || shortenAddress(holding.mint),
      pct: holding.allocationPct,
      hue: hueFromMint(holding.mint),
    })),
    ...(othersPct > 0.01
      ? [{ key: "others", label: `Others (${rest.length})`, pct: othersPct, hue: 220 }]
      : []),
  ];

  return (
    <div className="rounded-2xl border border-line bg-card p-6 lg:col-span-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-dim">Allocation</p>
      {segments.length === 0 ? (
        <p className="mt-4 text-sm text-ink-dim">No priced holdings to break down yet.</p>
      ) : (
        <>
          <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-bg-soft">
            {segments.map((segment) => (
              <div
                key={segment.key}
                title={`${segment.label} · ${segment.pct.toFixed(1)}%`}
                style={{
                  width: `${Math.max(segment.pct, 0.5)}%`,
                  backgroundColor: `hsl(${segment.hue} 65% 52%)`,
                }}
                className="h-full transition-all"
              />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            {segments.map((segment) => (
              <div key={segment.key} className="flex items-center gap-2 text-sm">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: `hsl(${segment.hue} 65% 52%)` }}
                />
                <span className="truncate font-medium text-ink">{segment.label}</span>
                <span className="ml-auto shrink-0 font-mono text-xs text-ink-dim">
                  {segment.pct.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function HoldingsTable({ holdings }: { holdings: PortfolioHolding[] }) {
  const navigate = useNavigate();

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-bg-soft text-[11px] uppercase tracking-wide text-ink-dim">
            <tr className="border-b border-line">
              <th className="px-4 py-2.5 font-medium">Asset</th>
              <th className="px-4 py-2.5 text-right font-medium">Price</th>
              <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">24h</th>
              <th className="hidden px-4 py-2.5 text-right font-medium lg:table-cell">Trend</th>
              <th className="px-4 py-2.5 text-right font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((holding) => {
              const isPriced = holding.valueUsd > 0;
              return (
                <tr
                  key={holding.mint}
                  onClick={() => navigate(`/token/${holding.mint}`)}
                  className="cursor-pointer border-b border-line/60 transition last:border-0 hover:bg-bg-soft/60"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <TokenAvatar
                        iconUrl={holding.imageUrl}
                        symbol={holding.symbol}
                        seed={holding.mint}
                        className="h-9 w-9"
                        textClassName="text-[10px]"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-semibold text-ink">
                            {holding.symbol || shortenAddress(holding.mint)}
                          </span>
                          {holding.isSol && (
                            <span className="shrink-0 rounded bg-brand-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand">
                              Native
                            </span>
                          )}
                        </div>
                        <span className="block truncate text-[11px] text-ink-dim">
                          {formatTokenAmount(holding.amount)}
                          {holding.name && holding.name !== holding.symbol
                            ? ` · ${holding.name}`
                            : ""}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-ink">
                    {isPriced ? formatPriceUsd(holding.priceUsd) : "—"}
                  </td>

                  <td className="hidden whitespace-nowrap px-4 py-3 text-right sm:table-cell">
                    {isPriced ? (
                      <div className="flex justify-end">
                        <PriceChangeBadge
                          value={holding.priceChange24h}
                          showTimeframeLabel={false}
                        />
                      </div>
                    ) : (
                      <span className="text-ink-dim">—</span>
                    )}
                  </td>

                  <td className="hidden px-4 py-3 lg:table-cell">
                    <div className="flex justify-end">
                      {holding.market && isPriced ? (
                        <Sparkline
                          points={sparkPointsFromPair(holding.market)}
                          up={holding.priceChange24h >= 0}
                          width={88}
                          height={28}
                        />
                      ) : (
                        <span className="text-ink-dim">—</span>
                      )}
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="font-semibold text-ink">
                      {isPriced ? `$${formatMoney(holding.valueUsd)}` : "—"}
                    </div>
                    {isPriced && (
                      <div className="text-[11px] text-ink-dim">
                        {holding.allocationPct.toFixed(1)}%
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** Address bar for viewing any wallet, plus a banner when viewing one. */
function AddressBar({
  value,
  onChange,
  onSubmit,
  connected,
  isViewingManual,
  viewedAddress,
  onViewConnected,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  connected: boolean;
  isViewingManual: boolean;
  viewedAddress: string | null;
  onViewConnected: () => void;
}) {
  const trimmed = value.trim();
  const isValid = trimmed.length === 0 || isLikelyAddress(trimmed);

  return (
    <div className="mt-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <div className="relative min-w-0 flex-1">
          <WalletIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-dim" />
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Paste any Solana wallet address to view"
            spellCheck={false}
            autoComplete="off"
            className={`w-full rounded-xl border bg-bg-soft py-2.5 pl-10 pr-3 text-sm text-ink outline-none transition placeholder:text-ink-dim ${
              isValid ? "border-line focus:border-accent" : "border-down/60 focus:border-down"
            }`}
          />
        </div>
        <button
          type="submit"
          disabled={!isLikelyAddress(trimmed)}
          className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-bg transition hover:bg-accent-dark disabled:opacity-40"
        >
          View wallet
        </button>
        {connected && (
          <button
            type="button"
            onClick={onViewConnected}
            className="rounded-xl border border-line bg-bg-soft px-4 py-2.5 text-sm font-semibold text-ink-dim transition hover:border-accent hover:text-ink"
          >
            My wallet
          </button>
        )}
      </form>

      {!isValid && (
        <p className="mt-1.5 text-xs text-down">That doesn't look like a Solana address.</p>
      )}

      {isViewingManual && viewedAddress && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-brand-soft/40 px-3 py-2 text-sm">
          <EyeIcon className="h-4 w-4 text-brand" />
          <span className="text-ink-dim">
            Viewing <span className="font-mono font-semibold text-ink">{shortenAddress(viewedAddress)}</span>{" "}
            <span className="text-ink-dim">(read-only)</span>
          </span>
          <button
            type="button"
            onClick={onViewConnected}
            className="ml-auto rounded-lg px-2 py-1 text-xs font-semibold text-brand hover:underline"
          >
            {connected ? "Back to my wallet" : "Clear"}
          </button>
        </div>
      )}
    </div>
  );
}

function ConnectPrompt() {
  return (
    <div className="mt-6 rounded-2xl border border-line bg-card p-10 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand">
        <WalletIcon className="h-7 w-7" />
      </div>
      <p className="mt-4 text-lg font-semibold text-ink">View any wallet</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-dim">
        Paste a Solana address above to explore it, or connect your own wallet for one-tap access.
        Either way it's read-only — you'll never be asked to sign or send anything.
      </p>
      <div className="mt-5 flex justify-center">
        <WalletButton />
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mt-6 rounded-2xl border border-line bg-card p-8 text-center">
      <p className="font-semibold text-ink">Something went wrong</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-dim">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-lg border border-line bg-bg-soft px-4 py-2 text-sm font-semibold text-ink transition hover:border-accent"
      >
        Try again
      </button>
    </div>
  );
}

function PortfolioSkeleton() {
  return (
    <div className="mt-6 animate-pulse">
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="h-40 rounded-2xl border border-line bg-card lg:col-span-2" />
        <div className="h-40 rounded-2xl border border-line bg-card lg:col-span-3" />
      </div>
      <div className="mt-8 h-8 w-40 rounded-lg bg-bg-soft" />
      <div className="mt-5 space-y-px overflow-hidden rounded-2xl border border-line bg-card">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-16 border-b border-line/60 bg-card last:border-0" />
        ))}
      </div>
    </div>
  );
}

/* --- icons ---------------------------------------------------------------- */

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M16 12h.01" />
      <path d="M3 9h14a2 2 0 0 1 2 2v0" />
    </svg>
  );
}
