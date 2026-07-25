import { useEffect, useState } from "react";
import { Spinner } from "../ui/Skeleton";
import { DEFAULT_CHAIN_ID, getChain } from "../../lib/chains";

export type ChartTheme = "dark" | "light";

interface PriceChartProps {
  pairAddress: string | null;
  /** Torch chain id the pair trades on (drives the Dexscreener chain slug). */
  chainId?: string;
  /** Timeframe/theme the chart opens on. */
  initialTheme?: ChartTheme;
  /**
   * Bare mode drops the DUX panel chrome (framed border, header toggle, footer)
   * and lets the chart fill its parent's height. Used inside the embeddable
   * iframe so integrators get an edge-to-edge chart.
   */
  fill?: boolean;
  /** When provided, an "Embed" action is shown in the chart header. */
  onEmbedClick?: () => void;
}

/**
 * Live price chart.
 *
 * We embed Dexscreener's chart widget so the candles, intervals, drawing tools
 * and data are always current and exactly as functional as Dexscreener itself.
 * Everything around it (header, stats, transactions) is our own, and we wrap the
 * widget in DUX chrome: a framed panel, a theme toggle and an external link.
 */
export default function PriceChart({
  pairAddress,
  chainId = DEFAULT_CHAIN_ID,
  initialTheme = "dark",
  fill = false,
  onEmbedClick,
}: PriceChartProps) {
  const [theme, setTheme] = useState<ChartTheme>(initialTheme);
  const [loaded, setLoaded] = useState(false);

  const dexSlug = getChain(chainId)?.dexscreenerSlug ?? "solana";

  // A fresh iframe load whenever the pair or theme changes.
  useEffect(() => {
    setLoaded(false);
  }, [pairAddress, theme]);

  const embedUrl = pairAddress
    ? `https://dexscreener.com/${dexSlug}/${pairAddress}?embed=1&theme=${theme}&info=0&trades=0`
    : null;

  const chart = (
    <div className={`relative w-full ${fill ? "h-full" : "h-[420px] md:h-[500px]"}`}>
      {embedUrl ? (
        <>
          <iframe
            key={embedUrl}
            src={embedUrl}
            title="Price chart"
            loading="lazy"
            allow="clipboard-write"
            onLoad={() => setLoaded(true)}
            className="absolute inset-0 h-full w-full border-0"
          />
          {!loaded && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-card text-ink-dim">
              <Spinner className="h-6 w-6" label="Loading live chart…" />
            </div>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-ink-dim">
          No live chart for this token yet.
        </div>
      )}
    </div>
  );

  // Bare mode: just the chart surface, no DUX panel chrome, filling its parent.
  if (fill) {
    return <div className="h-full w-full bg-card">{chart}</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-b border-line px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-dim">
          Price Chart
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {onEmbedClick && (
            <button
              onClick={onEmbedClick}
              className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-ink-dim transition hover:border-brand hover:text-brand"
              title="Embed this chart on your website"
            >
              {"</>"} Embed
            </button>
          )}
          <div className="flex items-center gap-1 rounded-lg bg-bg-soft p-0.5">
            {(["dark", "light"] as ChartTheme[]).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition ${
                  theme === t ? "bg-card text-ink shadow-sm" : "text-ink-dim hover:text-ink"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {pairAddress && (
            <a
              href={`https://dexscreener.com/${dexSlug}/${pairAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-ink-dim transition hover:border-brand hover:text-brand"
              title="Open the full chart"
            >
              Expand ↗
            </a>
          )}
        </div>
      </div>

      {chart}

      <div className="border-t border-line px-4 py-1.5 text-right text-[10px] text-ink-dim">
        Live chart data via Dexscreener
      </div>
    </div>
  );
}
