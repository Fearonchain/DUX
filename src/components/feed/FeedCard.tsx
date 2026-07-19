import { Link } from "react-router-dom";
import { relTime, shortenAddress, type TokenProfile } from "../../lib/types";
import {
  formatPercent,
  formatPriceUsd,
  sparkPointsFromPair,
  type MarketPair,
  type TokenBrief,
} from "../../lib/market";
import Sparkline from "../token/Sparkline";

interface FeedCardProps {
  profile: TokenProfile;
  market: MarketPair | null | undefined;
  brief: TokenBrief | undefined;
  isFresh: boolean;
}

/** Single token profile rendered as a rich card in the live feed grid. */
export default function FeedCard({ profile, market, brief, isFresh }: FeedCardProps) {
  const icon = brief?.imageUrl ?? profile.icon;
  const name = brief?.name?.trim();
  const symbol = brief?.symbol?.trim();

  return (
    <Link
      to={`/token/${profile.tokenAddress}`}
      className={`overflow-hidden rounded-xl border border-line bg-card transition hover:-translate-y-0.5 hover:border-accent hover:shadow-lg hover:shadow-black/5 ${
        isFresh ? "animate-flash" : ""
      }`}
    >
      <div className="aspect-[3/1] bg-bg-soft">
        {profile.header && (
          <img
            src={profile.header}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover object-center"
          />
        )}
      </div>
      <div className="p-3.5">
        <div className="flex items-center gap-2">
          {icon && (
            <img
              src={icon}
              alt=""
              loading="lazy"
              className="h-7 w-7 rounded-full bg-bg-soft object-cover"
            />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-ink">
                {name || shortenAddress(profile.tokenAddress)}
              </span>
              {symbol && (
                <span className="shrink-0 font-mono text-[10px] uppercase text-ink-dim">
                  {symbol}
                </span>
              )}
            </div>
            {name && (
              <span className="block truncate font-mono text-[11px] text-ink-dim">
                {shortenAddress(profile.tokenAddress)}
              </span>
            )}
          </div>
          {isFresh && (
            <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-bg">
              UPDATED
            </span>
          )}
          <span className="ml-auto shrink-0 text-xs text-ink-dim">{relTime(profile.updatedAt)}</span>
        </div>

        {market && (
          <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-line bg-bg-soft px-2.5 py-2">
            <div>
              <p className="font-mono text-sm font-semibold text-ink">
                {formatPriceUsd(market.priceUsd)}
              </p>
              <span
                className={`text-[11px] font-semibold ${
                  market.priceChange.h24 >= 0 ? "text-up" : "text-down"
                }`}
              >
                {formatPercent(market.priceChange.h24)} · 24h
              </span>
            </div>
            <Sparkline points={sparkPointsFromPair(market)} up={market.priceChange.h24 >= 0} />
          </div>
        )}

        {profile.description && (
          <p className="mt-2 line-clamp-2 text-[13px] text-ink-dim">{profile.description}</p>
        )}

        {profile.links.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {profile.links.map((l, i) => (
              <span
                key={i}
                className="rounded-full border border-line bg-bg-soft px-2.5 py-0.5 text-xs text-ink-dim"
              >
                {l.label || l.type || "link"}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
