import { useState } from "react";
import {
  useWatchlist,
  formatAlertValue,
  type AlertDirection,
  type AlertMetric,
} from "../../lib/watchlist";
import {
  compactUnitMultiplier,
  formatUsdCompact,
  parseCompactNumber,
  splitCompact,
  type CompactUnit,
} from "../../lib/market";

interface AlertFormProps {
  address: string;
  /** Current live price, used to prefill/label a price alert. */
  currentPrice?: number | null;
  /** Current live market cap, used to prefill/label a market-cap alert. */
  currentMarketCap?: number | null;
  onCreated?: () => void;
}

/** Modern form to create a price- or market-cap alert for a single token. */
export default function AlertForm({
  address,
  currentPrice,
  currentMarketCap,
  onCreated,
}: AlertFormProps) {
  const { addAlert } = useWatchlist();
  const [metric, setMetric] = useState<AlertMetric>("price");
  const [direction, setDirection] = useState<AlertDirection>("above");
  const [priceText, setPriceText] = useState(
    currentPrice && currentPrice > 0 ? String(currentPrice) : ""
  );

  const initialMarketCap =
    currentMarketCap && currentMarketCap > 0
      ? splitCompact(currentMarketCap)
      : { mantissa: "", unit: "M" as CompactUnit };
  const [marketCapMantissa, setMarketCapMantissa] = useState(initialMarketCap.mantissa);
  const [marketCapUnit, setMarketCapUnit] = useState<CompactUnit>(initialMarketCap.unit || "M");
  const [error, setError] = useState<string | null>(null);

  const currentValue = metric === "price" ? currentPrice : currentMarketCap;
  const targetValue =
    metric === "price"
      ? parseCompactNumber(priceText)
      : Number.parseFloat(marketCapMantissa) * compactUnitMultiplier(marketCapUnit);

  /** Type "693.22m" and we peel off the suffix into the unit dropdown for you. */
  function handleMarketCapChange(raw: string) {
    const cleaned = raw.replace(/[$,\s]/g, "");
    const unitMatch = cleaned.match(/([kmb])$/i);
    if (unitMatch) {
      setMarketCapUnit(unitMatch[1].toUpperCase() as CompactUnit);
      setMarketCapMantissa(cleaned.slice(0, -1));
    } else {
      setMarketCapMantissa(cleaned);
    }
  }

  function applyCurrentValue() {
    if (!currentValue || currentValue <= 0) return;
    if (metric === "price") {
      setPriceText(String(currentValue));
      return;
    }
    const split = splitCompact(currentValue);
    setMarketCapMantissa(split.mantissa);
    setMarketCapUnit(split.unit || "M");
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!Number.isFinite(targetValue) || targetValue <= 0) {
      setError("Enter a target greater than 0.");
      return;
    }
    setError(null);
    addAlert({ address, metric, direction, targetValue });
    onCreated?.();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Segmented label="Alert metric">
        <SegmentButton active={metric === "price"} onClick={() => setMetric("price")}>
          <TagIcon className="h-3.5 w-3.5" />
          Price
        </SegmentButton>
        <SegmentButton active={metric === "marketCap"} onClick={() => setMetric("marketCap")}>
          <ChartIcon className="h-3.5 w-3.5" />
          Market cap
        </SegmentButton>
      </Segmented>

      <Segmented label="Alert direction">
        <SegmentButton active={direction === "above"} onClick={() => setDirection("above")}>
          <ArrowIcon className="h-3.5 w-3.5" up />
          Rises above
        </SegmentButton>
        <SegmentButton active={direction === "below"} onClick={() => setDirection("below")}>
          <ArrowIcon className="h-3.5 w-3.5" up={false} />
          Falls below
        </SegmentButton>
      </Segmented>

      <div>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-semibold text-ink-dim">
            $
          </span>
          {metric === "price" ? (
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
              placeholder="Target price"
              aria-label="Target price in USD"
              className="w-full rounded-xl border border-line bg-bg-soft py-3 pl-8 pr-3 font-mono text-base font-semibold text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
          ) : (
            <input
              type="text"
              inputMode="decimal"
              value={marketCapMantissa}
              onChange={(e) => handleMarketCapChange(e.target.value)}
              placeholder="e.g. 693"
              aria-label="Target market cap amount"
              className="w-full rounded-xl border border-line bg-bg-soft py-3 pl-8 pr-3 font-mono text-base font-semibold text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
          )}
        </div>

        {metric === "marketCap" ? (
          <>
            <Segmented label="Market cap unit" cols={3} className="mt-2">
              <SegmentButton active={marketCapUnit === "K"} onClick={() => setMarketCapUnit("K")}>
                Thousands
              </SegmentButton>
              <SegmentButton active={marketCapUnit === "M"} onClick={() => setMarketCapUnit("M")}>
                Millions
              </SegmentButton>
              <SegmentButton active={marketCapUnit === "B"} onClick={() => setMarketCapUnit("B")}>
                Billions
              </SegmentButton>
            </Segmented>
            <p className="mt-2 pl-1 text-xs text-ink-dim">
              {Number.isFinite(targetValue) && targetValue > 0 ? (
                <>
                  Alerts when market cap is{" "}
                  <span className="font-semibold text-ink">
                    {direction === "above" ? "above" : "below"} {formatUsdCompact(targetValue)}
                  </span>
                </>
              ) : (
                <>Enter an amount, then pick a size above.</>
              )}
            </p>
          </>
        ) : null}

        {currentValue && currentValue > 0 ? (
          <button
            type="button"
            onClick={applyCurrentValue}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-line bg-bg-soft px-2.5 py-1 text-xs text-ink-dim transition hover:border-accent hover:text-ink"
            title="Use the current value"
          >
            Use current: {formatAlertValue(currentValue, metric)}
          </button>
        ) : null}
      </div>

      {error && <p className="text-xs font-medium text-down">{error}</p>}

      <button
        type="submit"
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white shadow-sm shadow-brand/30 transition hover:brightness-110 active:scale-[0.99]"
      >
        <BellIcon className="h-4 w-4" />
        Create alert
      </button>
    </form>
  );
}

function Segmented({
  label,
  cols = 2,
  className = "",
  children,
}: {
  label: string;
  cols?: 2 | 3;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={`grid gap-1 rounded-xl border border-line bg-bg-soft p-1 ${
        cols === 3 ? "grid-cols-3" : "grid-cols-2"
      } ${className}`}
    >
      {children}
    </div>
  );
}

function SegmentButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
        active
          ? "bg-brand text-white shadow-sm shadow-brand/30"
          : "text-ink-dim hover:bg-card/60 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function ArrowIcon({ up, className }: { up: boolean; className?: string }) {
  return (
    <svg
      className={`${className} ${up ? "text-up" : "text-down"}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {up ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M5 12l7 7 7-7" />}
    </svg>
  );
}

function TagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3v18h18" />
      <rect x="7" y="12" width="3" height="6" />
      <rect x="12" y="8" width="3" height="10" />
      <rect x="17" y="4" width="3" height="14" />
    </svg>
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
