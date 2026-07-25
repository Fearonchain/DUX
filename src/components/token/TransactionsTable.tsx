import {
  formatCompact,
  formatPriceUsd,
  formatUsdCompact,
  relTimeShort,
  type Trade,
} from "../../lib/market";
import { DEFAULT_CHAIN_ID, explorerAccountUrl } from "../../lib/chains";
import { Skeleton } from "../ui/Skeleton";

function shortWallet(w: string): string {
  return w.length > 8 ? `${w.slice(0, 4)}…${w.slice(-4)}` : w || "—";
}

/** Placeholder rows shown while the first batch of trades is loading. */
function TradeRowSkeleton() {
  return (
    <tr className="border-b border-line/60">
      <td className="px-4 py-2.5">
        <Skeleton className="h-3 w-14 rounded-full" />
      </td>
      <td className="px-4 py-2.5">
        <Skeleton className="h-3 w-8 rounded-full" />
      </td>
      <td className="px-4 py-2.5">
        <Skeleton className="ml-auto h-3 w-16 rounded-full" />
      </td>
      <td className="hidden px-4 py-2.5 sm:table-cell">
        <Skeleton className="ml-auto h-3 w-14 rounded-full" />
      </td>
      <td className="hidden px-4 py-2.5 md:table-cell">
        <Skeleton className="ml-auto h-3 w-16 rounded-full" />
      </td>
      <td className="px-4 py-2.5">
        <Skeleton className="ml-auto h-3 w-16 rounded-full" />
      </td>
    </tr>
  );
}

/** Recent on-chain trades for the pool. */
export default function TransactionsTable({
  trades,
  baseSymbol,
  loading,
  chainId = DEFAULT_CHAIN_ID,
}: {
  trades: Trade[];
  baseSymbol: string;
  loading: boolean;
  chainId?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-card">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="h-2 w-2 animate-pulse-dot rounded-full bg-up" />
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-dim">
          Recent Transactions
        </span>
      </div>

      <div className="max-h-[440px] overflow-auto">
        <table className="w-full min-w-[360px] text-left text-[13px]">
          <thead className="sticky top-0 z-10 bg-card text-[11px] uppercase tracking-wide text-ink-dim">
            <tr className="border-b border-line">
              <th className="px-4 py-2 font-medium">Time</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 text-right font-medium">USD</th>
              <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">{baseSymbol}</th>
              <th className="hidden px-4 py-2 text-right font-medium md:table-cell">Price</th>
              <th className="px-4 py-2 text-right font-medium">Trader</th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              trades.length === 0 &&
              Array.from({ length: 8 }).map((_, i) => <TradeRowSkeleton key={i} />)}
            {trades.map((t) => (
              <tr
                key={t.id}
                className="border-b border-line/60 transition hover:bg-bg-soft/60"
              >
                <td className="whitespace-nowrap px-4 py-2 text-ink-dim">
                  {relTimeShort(t.timestamp)} ago
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`font-semibold ${t.kind === "buy" ? "text-up" : "text-down"}`}
                  >
                    {t.kind === "buy" ? "Buy" : "Sell"}
                  </span>
                </td>
                <td
                  className={`px-4 py-2 text-right font-mono ${
                    t.kind === "buy" ? "text-up" : "text-down"
                  }`}
                >
                  {formatUsdCompact(t.amountUsd)}
                </td>
                <td className="hidden px-4 py-2 text-right font-mono text-ink sm:table-cell">
                  {formatCompact(t.baseAmount)}
                </td>
                <td className="hidden px-4 py-2 text-right font-mono text-ink-dim md:table-cell">
                  {formatPriceUsd(t.priceUsd)}
                </td>
                <td className="px-4 py-2 text-right">
                  <a
                    href={explorerAccountUrl(chainId, t.wallet)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-ink-dim transition hover:text-ink"
                  >
                    {shortWallet(t.wallet)}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && trades.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-ink-dim">
            No recent transactions found.
          </p>
        )}
      </div>
    </div>
  );
}
