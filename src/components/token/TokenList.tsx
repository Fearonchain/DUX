import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { relTime, shortenAddress } from "../../lib/types";
import { formatPriceUsd, sparkPointsFromPair } from "../../lib/market";
import Sparkline from "./Sparkline";
import {
  PriceChangeBadge,
  TokenAvatar,
  resolveTokenIdentity,
  type TokenViewItem,
} from "./tokenView";

interface TokenListProps {
  list_of_items: TokenViewItem[];
  /** Render a trailing action cell per row, e.g. an "Add alert" button. */
  renderAction?: (item: TokenViewItem) => ReactNode;
  actionHeader?: string;
  /** Show the "Description" and "Links" columns (live-feed profiles only). */
  showProfileColumns?: boolean;
  /** Show the "Updated" column. */
  showUpdatedColumn?: boolean;
}

/** Dense list view of tokens — one row each. Shared by the feed and watchlist. */
export default function TokenList({
  list_of_items,
  renderAction,
  actionHeader = "",
  showProfileColumns = false,
  showUpdatedColumn = false,
}: TokenListProps) {
  const navigate = useNavigate();

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-bg-soft text-[11px] uppercase tracking-wide text-ink-dim">
            <tr className="border-b border-line">
              <th className="px-4 py-2.5 font-medium">Token</th>
              <th className="px-4 py-2.5 text-right font-medium">Price</th>
              <th className="px-4 py-2.5 text-right font-medium">24h</th>
              <th className="hidden px-4 py-2.5 text-right font-medium lg:table-cell">Trend</th>
              {showProfileColumns && (
                <>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Description</th>
                  <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Links</th>
                </>
              )}
              {showUpdatedColumn && (
                <th className="px-4 py-2.5 text-right font-medium">Updated</th>
              )}
              {renderAction && (
                <th className="px-4 py-2.5 text-right font-medium">{actionHeader}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {list_of_items.map((item) => {
              const { address, market, description, list_of_links, updatedAt, isFresh } = item;
              const { iconUrl, name, symbol, isPriceUp } = resolveTokenIdentity(item);

              return (
                <tr
                  key={address}
                  onClick={() => navigate(`/token/${address}`)}
                  className={`cursor-pointer border-b border-line/60 transition last:border-0 hover:bg-bg-soft/60 ${
                    isFresh ? "bg-bg-soft" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <TokenAvatar
                        iconUrl={iconUrl}
                        symbol={symbol}
                        seed={address}
                        className="h-8 w-8"
                        textClassName="text-[10px]"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-semibold text-ink">
                            {name || symbol || shortenAddress(address)}
                          </span>
                          {symbol && name && (
                            <span className="shrink-0 font-mono text-[10px] uppercase text-ink-dim">
                              {symbol}
                            </span>
                          )}
                          {isFresh && (
                            <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-bg">
                              UPDATED
                            </span>
                          )}
                        </div>
                        <span className="block truncate font-mono text-[11px] text-ink-dim">
                          {shortenAddress(address)}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-ink">
                    {market ? formatPriceUsd(market.priceUsd) : "—"}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {market ? (
                      <div className="flex justify-end">
                        <PriceChangeBadge value={market.priceChange.h24} showTimeframeLabel={false} />
                      </div>
                    ) : (
                      <span className="text-ink-dim">—</span>
                    )}
                  </td>

                  <td className="hidden px-4 py-3 lg:table-cell">
                    <div className="flex justify-end">
                      {market ? (
                        <Sparkline points={sparkPointsFromPair(market)} up={isPriceUp} width={88} height={28} />
                      ) : (
                        <span className="text-ink-dim">—</span>
                      )}
                    </div>
                  </td>

                  {showProfileColumns && (
                    <>
                      <td className="hidden max-w-[280px] px-4 py-3 md:table-cell">
                        <span className="line-clamp-1 text-ink-dim">{description || "—"}</span>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        {list_of_links && list_of_links.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {list_of_links.slice(0, 3).map((link, index) => (
                              <span
                                key={index}
                                className="rounded-full border border-line bg-bg-soft px-2 py-0.5 text-[11px] text-ink-dim"
                              >
                                {link.label || link.type || "link"}
                              </span>
                            ))}
                            {list_of_links.length > 3 && (
                              <span className="px-1 py-0.5 text-[11px] text-ink-dim">
                                +{list_of_links.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-ink-dim">—</span>
                        )}
                      </td>
                    </>
                  )}

                  {showUpdatedColumn && (
                    <td className="whitespace-nowrap px-4 py-3 text-right text-ink-dim">
                      {updatedAt ? relTime(updatedAt) : "—"}
                    </td>
                  )}

                  {renderAction && (
                    <td
                      className="px-4 py-3 text-right"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex justify-end">{renderAction(item)}</div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
