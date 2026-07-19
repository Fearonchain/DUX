import { useState } from "react";
import {
  formatCompact,
  formatPercent,
  formatPriceUsd,
  formatUsdCompact,
  type MarketPair,
} from "../../lib/market";

type Window = "m5" | "h1" | "h6" | "h24";
const WINDOWS: { key: Window; label: string }[] = [
  { key: "m5", label: "5M" },
  { key: "h1", label: "1H" },
  { key: "h6", label: "6H" },
  { key: "h24", label: "24H" },
];

function deltaClass(value: number): string {
  if (value > 0) return "text-up";
  if (value < 0) return "text-down";
  return "text-ink-dim";
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-bg-soft px-3.5 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-dim">{label}</p>
      <p className="mt-1 font-mono text-[15px] font-semibold text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-ink-dim">{sub}</p>}
    </div>
  );
}

/** Right-rail market stats: price, depth, momentum and buy/sell pressure. */
export default function StatsPanel({ pair }: { pair: MarketPair }) {
  const [window, setWindow] = useState<Window>("h24");

  const change = pair.priceChange[window];
  const txns = pair.txns[window];
  const volume = pair.volume[window];
  const totalTxns = txns.buys + txns.sells;
  const buyRatio = totalTxns > 0 ? (txns.buys / totalTxns) * 100 : 50;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4">
      <div className="grid grid-cols-2 gap-3">
        <Tile label="Price USD" value={formatPriceUsd(pair.priceUsd)} />
        <Tile
          label={`Price ${pair.quoteSymbol}`}
          value={pair.priceNative.toLocaleString("en-US", { maximumSignificantDigits: 5 })}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Tile label="Liquidity" value={formatUsdCompact(pair.liquidityUsd)} />
        <Tile label="FDV" value={formatUsdCompact(pair.fdv)} />
        <Tile label="Mkt Cap" value={formatUsdCompact(pair.marketCap)} />
      </div>

      {/* momentum window selector */}
      <div className="grid grid-cols-4 overflow-hidden rounded-xl border border-line">
        {WINDOWS.map((w, i) => {
          const active = window === w.key;
          const wChange = pair.priceChange[w.key];
          return (
            <button
              key={w.key}
              onClick={() => setWindow(w.key)}
              className={`flex flex-col items-center gap-1 px-1 py-2.5 text-center transition ${
                i > 0 ? "border-l border-line" : ""
              } ${active ? "bg-bg-soft" : "hover:bg-bg-soft/60"}`}
            >
              <span className="text-[11px] font-medium text-ink-dim">{w.label}</span>
              <span className={`text-[13px] font-semibold ${deltaClass(wChange)}`}>
                {formatPercent(wChange)}
              </span>
            </button>
          );
        })}
      </div>

      {/* buy vs sell pressure */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-[13px]">
          <span className="font-semibold text-up">{formatCompact(txns.buys)} buys</span>
          <span className="text-ink-dim">{formatCompact(totalTxns)} txns</span>
          <span className="font-semibold text-down">{formatCompact(txns.sells)} sells</span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-down/25">
          <div
            className="h-full bg-up transition-all"
            style={{ width: `${buyRatio}%` }}
            aria-label={`${buyRatio.toFixed(0)}% buys`}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Tile label={`Volume ${WINDOWS.find((w) => w.key === window)?.label}`} value={formatUsdCompact(volume)} />
        <Tile label="Change" value={formatPercent(change)} sub={pair.dexId ? `via ${pair.dexId}` : undefined} />
      </div>
    </div>
  );
}
