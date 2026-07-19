import { useNavigate } from "react-router-dom";
import { relTime, shortenAddress, type TokenProfile } from "../../lib/types";
import {
  formatPercent,
  formatPriceUsd,
  sparkPointsFromPair,
  type MarketPair,
  type TokenBrief,
} from "../../lib/market";
import Sparkline from "../token/Sparkline";

interface FeedTableProps {
  profiles: TokenProfile[];
  markets: Record<string, MarketPair | null>;
  briefs: Record<string, TokenBrief>;
  fresh: Set<string>;
}

/** Dense, sortable-looking list view of the live feed — one row per token. */
export default function FeedTable({ profiles, markets, briefs, fresh }: FeedTableProps) {
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
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Description</th>
              <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Links</th>
              <th className="px-4 py-2.5 text-right font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => {
              const market = markets[p.tokenAddress];
              const brief = briefs[p.tokenAddress];
              const icon = brief?.imageUrl ?? p.icon;
              const name = brief?.name?.trim();
              const symbol = brief?.symbol?.trim();
              const up = (market?.priceChange.h24 ?? 0) >= 0;

              return (
                <tr
                  key={p.tokenAddress}
                  onClick={() => navigate(`/token/${p.tokenAddress}`)}
                  className={`cursor-pointer border-b border-line/60 transition last:border-0 hover:bg-bg-soft/60 ${
                    fresh.has(p.tokenAddress) ? "bg-bg-soft" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {icon ? (
                        <img
                          src={icon}
                          alt=""
                          loading="lazy"
                          className="h-8 w-8 shrink-0 rounded-full bg-bg-soft object-cover"
                        />
                      ) : (
                        <span className="h-8 w-8 shrink-0 rounded-full bg-bg-soft" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-semibold text-ink">
                            {name || shortenAddress(p.tokenAddress)}
                          </span>
                          {symbol && (
                            <span className="shrink-0 font-mono text-[10px] uppercase text-ink-dim">
                              {symbol}
                            </span>
                          )}
                          {fresh.has(p.tokenAddress) && (
                            <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-white">
                              UPDATED
                            </span>
                          )}
                        </div>
                        <span className="block truncate font-mono text-[11px] text-ink-dim">
                          {shortenAddress(p.tokenAddress)}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-ink">
                    {market ? formatPriceUsd(market.priceUsd) : "—"}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold">
                    {market ? (
                      <span className={up ? "text-up" : "text-down"}>
                        {formatPercent(market.priceChange.h24)}
                      </span>
                    ) : (
                      <span className="text-ink-dim">—</span>
                    )}
                  </td>

                  <td className="hidden px-4 py-3 lg:table-cell">
                    <div className="flex justify-end">
                      {market ? (
                        <Sparkline points={sparkPointsFromPair(market)} up={up} width={88} height={28} />
                      ) : (
                        <span className="text-ink-dim">—</span>
                      )}
                    </div>
                  </td>

                  <td className="hidden max-w-[280px] px-4 py-3 md:table-cell">
                    <span className="line-clamp-1 text-ink-dim">{p.description || "—"}</span>
                  </td>

                  <td className="hidden px-4 py-3 sm:table-cell">
                    {p.links.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {p.links.slice(0, 3).map((l, i) => (
                          <span
                            key={i}
                            className="rounded-full border border-line bg-bg-soft px-2 py-0.5 text-[11px] text-ink-dim"
                          >
                            {l.label || l.type || "link"}
                          </span>
                        ))}
                        {p.links.length > 3 && (
                          <span className="px-1 py-0.5 text-[11px] text-ink-dim">
                            +{p.links.length - 3}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-ink-dim">—</span>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-right text-ink-dim">
                    {relTime(p.updatedAt)}
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
