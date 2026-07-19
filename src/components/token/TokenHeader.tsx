import { useState } from "react";
import { formatPercent, formatPriceUsd } from "../../lib/market";
import { shortenAddress } from "../../lib/types";

interface TokenHeaderProps {
  address: string;
  name: string;
  symbol: string;
  imageUrl: string | null;
  bannerUrl?: string | null;
  priceUsd: number;
  change24h: number;
  dexId: string;
}

/** Identity + live price banner at the top of the token dashboard. */
export default function TokenHeader({
  address,
  name,
  symbol,
  imageUrl,
  bannerUrl = null,
  priceUsd,
  change24h,
  dexId,
}: TokenHeaderProps) {
  const [copied, setCopied] = useState(false);
  const up = change24h >= 0;
  const hasBanner = Boolean(bannerUrl);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div
      className={`relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-2xl border border-line p-4 ${
        hasBanner ? "aspect-[3/1] min-h-[160px] max-h-[200px]" : "bg-card"
      }`}
    >
      {hasBanner && (
        <>
          <img
            src={bannerUrl ?? undefined}
            alt="token banner"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/30" />
        </>
      )}
      <div className={`relative flex items-center gap-3.5 ${hasBanner ? "mt-auto" : ""}`}>
        <div
          className={`grid h-14 w-14 place-items-center overflow-hidden rounded-2xl border ${
            hasBanner ? "border-white/20 bg-black/30" : "border-line bg-bg-soft"
          }`}
        >
          {imageUrl ? (
            <img src={imageUrl} alt={symbol} className="h-full w-full object-cover" />
          ) : (
            <span
              className={`font-mono text-lg font-bold ${hasBanner ? "text-white/80" : "text-ink-dim"}`}
            >
              {symbol.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className={`text-xl font-bold leading-none ${hasBanner ? "text-white" : "text-ink"}`}>
              {symbol}
            </h1>
            <span className="rounded-md border border-brand/40 bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">
              Solana
            </span>
            {dexId && (
              <span
                className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                  hasBanner
                    ? "border-white/20 bg-black/30 text-white/80"
                    : "border-line bg-bg-soft text-ink-dim"
                }`}
              >
                {dexId}
              </span>
            )}
          </div>
          <p
            className={`mt-1 max-w-[220px] truncate text-sm sm:max-w-xs ${
              hasBanner ? "text-white/80" : "text-ink-dim"
            }`}
          >
            {name}
          </p>
          <button
            onClick={copyAddress}
            className={`mt-1 inline-flex items-center gap-1.5 font-mono text-[11px] transition ${
              hasBanner ? "text-white/70 hover:text-white" : "text-ink-dim hover:text-ink"
            }`}
            title="Copy contract address"
          >
            {shortenAddress(address)}
            <span className="text-[10px] uppercase tracking-wide">{copied ? "copied" : "copy"}</span>
          </button>
        </div>
      </div>

      <div className={`relative flex items-center gap-4 ${hasBanner ? "mt-auto" : ""}`}>
        <div className="text-right">
          <p
            className={`font-mono text-2xl font-bold leading-none ${
              hasBanner ? "text-white" : "text-ink"
            }`}
          >
            {formatPriceUsd(priceUsd)}
          </p>
          <span
            className={`mt-1.5 inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${
              up ? "bg-up-soft text-up" : "bg-down-soft text-down"
            }`}
          >
            {formatPercent(change24h)} · 24h
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <a
            href={`https://jup.ag/swap/SOL-${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-up px-5 py-2 text-center text-sm font-bold text-white transition hover:brightness-110"
          >
            Buy
          </a>
          <a
            href={`https://jup.ag/swap/${address}-SOL`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-down px-5 py-2 text-center text-sm font-bold text-white transition hover:brightness-110"
          >
            Sell
          </a>
        </div>
      </div>
    </div>
  );
}
