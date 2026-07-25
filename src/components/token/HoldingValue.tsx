import { useEffect, useState } from "react";
import { useWallet } from "../WalletProviders";
import { fetchWalletBalances, formatTokenAmount } from "../../lib/portfolio";
import { formatPriceUsd, formatUsdCompact } from "../../lib/market";

/** How often we re-read the wallet balance so buys/sells eventually show up. */
const BALANCE_REFRESH_MS = 60000;

/** Precise dollars for normal positions, compact for very large ones. */
function formatPositionUsd(value: number): string {
  if (!Number.isFinite(value)) return "$0.00";
  if (Math.abs(value) >= 1_000_000) return formatUsdCompact(value);
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * "Your position" card for the token page. When a wallet is connected and holds
 * the token being viewed, it shows the live USD value of that holding. The value
 * is derived from `priceUsd`, which the token page refreshes on an interval, so
 * it re-renders on its own as the price moves — no extra polling needed here.
 */
export default function HoldingValue({
  address,
  priceUsd,
  symbol,
}: {
  address: string;
  priceUsd: number | null;
  symbol: string;
}) {
  const { address: walletAddress, connected } = useWallet();
  const [amountHeld, setAmountHeld] = useState<number | null>(null);

  useEffect(() => {
    if (!connected || !walletAddress) {
      setAmountHeld(null);
      return;
    }

    let stop = false;
    async function loadBalance() {
      try {
        const balances = await fetchWalletBalances(walletAddress!);
        if (stop) return;
        const held = balances.find((balance) => balance.mint === address);
        setAmountHeld(held ? held.amount : 0);
      } catch {
        if (!stop) setAmountHeld(null);
      }
    }

    loadBalance();
    const interval = setInterval(loadBalance, BALANCE_REFRESH_MS);
    return () => {
      stop = true;
      clearInterval(interval);
    };
  }, [walletAddress, connected, address]);

  // Nothing to show until we confirm the wallet actually holds this token.
  if (!connected || amountHeld === null || amountHeld <= 0) return null;

  const valueUsd = priceUsd != null ? amountHeld * priceUsd : null;

  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="font-semibold">Your position</h3>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-dim">
          <span className="h-1.5 w-1.5 rounded-full bg-up animate-pulse-dot" />
          Live
        </span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-2xl font-bold leading-none tabular-nums transition-colors">
            {valueUsd != null ? formatPositionUsd(valueUsd) : "—"}
          </p>
          <p className="mt-1.5 truncate text-sm text-ink-dim">
            {formatTokenAmount(amountHeld)} {symbol}
          </p>
        </div>
        {priceUsd != null && (
          <p className="shrink-0 text-right text-xs text-ink-dim">
            @ {formatPriceUsd(priceUsd)}
          </p>
        )}
      </div>
    </section>
  );
}
