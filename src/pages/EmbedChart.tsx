import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { fetchMarketPair, formatPercent, formatPriceUsd, type MarketPair } from "../lib/market";
import { shortenAddress } from "../lib/types";
import PriceChart, { type ChartTheme } from "../components/token/PriceChart";
import { Spinner } from "../components/ui/Skeleton";

const PRICE_REFRESH_MS = 20000;

const THEME_PALETTE: Record<ChartTheme, { bg: string; surface: string; text: string; dim: string; line: string }> = {
  dark: { bg: "#0b0e11", surface: "#12161c", text: "#e5e7eb", dim: "#9ca3af", line: "#222831" },
  light: { bg: "#ffffff", surface: "#ffffff", text: "#0a0a0a", dim: "#6b7280", line: "#e3e6ea" },
};

/**
 * Standalone, chrome-free DUX chart designed to be dropped into an <iframe> on a
 * third-party site. It renders the DUX chart edge-to-edge with a slim branded
 * header (symbol + live price) and a "Powered by DUX" attribution link. Theme is
 * controlled by the `?theme=dark|light` query param so the snippet matches the
 * host site.
 */
export default function EmbedChart() {
  const { address = "" } = useParams();
  const [searchParams] = useSearchParams();
  const theme: ChartTheme = searchParams.get("theme") === "light" ? "light" : "dark";
  const palette = THEME_PALETTE[theme];

  const [pair, setPair] = useState<MarketPair | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stop = false;

    async function loadPrice(initial: boolean) {
      const p = await fetchMarketPair(address);
      if (stop) return;
      setPair(p);
      if (initial) setLoading(false);
    }

    loadPrice(true);
    const iv = setInterval(() => loadPrice(false), PRICE_REFRESH_MS);
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, [address]);

  const up = (pair?.priceChange.h24 ?? 0) >= 0;
  const tokenUrl = `${window.location.origin}/token/${address}`;

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden"
      style={{ backgroundColor: palette.bg, color: palette.text }}
    >
      {/* slim DUX-branded header */}
      <div
        className="flex items-center justify-between gap-3 px-3 py-2"
        style={{ borderBottom: `1px solid ${palette.line}` }}
      >
        <a
          href={tokenUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 items-center gap-2"
          title="Open on DUX"
        >
          <img src="/logo.png" alt="DUX" className="h-5 w-5 shrink-0" />
          <span className="truncate text-sm font-bold">
            {pair?.baseSymbol ?? shortenAddress(address)}
          </span>
          {pair && (
            <span className="truncate text-xs" style={{ color: palette.dim }}>
              {pair.baseName}
            </span>
          )}
        </a>

        <div className="flex shrink-0 items-center gap-2">
          {pair ? (
            <>
              <span className="font-mono text-sm font-bold">{formatPriceUsd(pair.priceUsd)}</span>
              <span
                className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
                style={{
                  color: up ? "#16a34a" : "#dc2626",
                  backgroundColor: up ? "rgba(22,163,74,0.14)" : "rgba(220,38,38,0.14)",
                }}
              >
                {formatPercent(pair.priceChange.h24)}
              </span>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: palette.dim }}>
              {loading ? (
                <>
                  <Spinner className="h-3 w-3" /> Loading…
                </>
              ) : (
                "No market"
              )}
            </span>
          )}
        </div>
      </div>

      {/* edge-to-edge chart */}
      <div className="min-h-0 flex-1" style={{ backgroundColor: palette.surface }}>
        <PriceChart pairAddress={pair?.pairAddress ?? null} initialTheme={theme} fill />
      </div>

      {/* attribution */}
      <div
        className="flex items-center justify-between px-3 py-1 text-[10px]"
        style={{ borderTop: `1px solid ${palette.line}`, color: palette.dim }}
      >
        <a
          href={tokenUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold transition hover:underline"
        >
          Powered by DUX
        </a>
        <span>Chart data via Dexscreener</span>
      </div>
    </div>
  );
}
