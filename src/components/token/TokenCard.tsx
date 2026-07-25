import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { relTime, shortenAddress } from "../../lib/types";
import { formatPriceUsd, sparkPointsFromPair } from "../../lib/market";
import { DEFAULT_CHAIN_ID } from "../../lib/chains";
import Sparkline from "./Sparkline";
import WatchButton from "../WatchButton";
import {
  PriceChangeBadge,
  TokenAvatar,
  resolveTokenIdentity,
  type TokenViewItem,
} from "./tokenView";

interface TokenCardProps {
  item: TokenViewItem;
  /** Optional action row pinned to the bottom, e.g. an "Add price alert" button. */
  footer?: ReactNode;
}

/**
 * A single token rendered as a rich card. Shared by the live feed and the
 * watchlist so both stay visually identical.
 */
export default function TokenCard({ item, footer }: TokenCardProps) {
  const { address, market, headerImageUrl, description, list_of_links, updatedAt, isFresh } = item;
  const chainId = item.chainId ?? DEFAULT_CHAIN_ID;
  const { iconUrl, name, symbol, isPriceUp } = resolveTokenIdentity(item);

  return (
    <Link
      to={`/token/${chainId}/${address}`}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-card transition hover:-translate-y-0.5 hover:border-accent hover:shadow-lg hover:shadow-black/5 ${
        isFresh ? "animate-flash" : ""
      }`}
    >
      <WatchButton address={address} chainId={chainId} compact className="absolute right-2 top-2 z-10" />

      {headerImageUrl !== undefined && (
        <div className="aspect-[3/1] bg-bg-soft">
          {headerImageUrl && (
            <img
              src={headerImageUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover object-center"
            />
          )}
        </div>
      )}

      <div className="flex flex-1 flex-col p-3.5">
        <div className="flex items-center gap-2.5">
          <TokenAvatar iconUrl={iconUrl} symbol={symbol} seed={address} className="h-9 w-9" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-ink">
                {name || symbol || shortenAddress(address)}
              </span>
              {symbol && name && (
                <span className="shrink-0 font-mono text-[10px] uppercase text-ink-dim">
                  {symbol}
                </span>
              )}
            </div>
            <span className="block truncate font-mono text-[11px] text-ink-dim">
              {shortenAddress(address)}
            </span>
          </div>
          {isFresh && (
            <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-bg">
              UPDATED
            </span>
          )}
          {updatedAt && (
            <span className="shrink-0 text-[11px] text-ink-dim">{relTime(updatedAt)}</span>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line bg-bg-soft px-3 py-2.5">
          {market ? (
            <>
              <div className="min-w-0">
                <p className="font-mono text-[15px] font-semibold leading-tight text-ink">
                  {formatPriceUsd(market.priceUsd)}
                </p>
                <div className="mt-1">
                  <PriceChangeBadge value={market.priceChange.h24} />
                </div>
              </div>
              <Sparkline points={sparkPointsFromPair(market)} up={isPriceUp} />
            </>
          ) : (
            <p className="text-xs text-ink-dim">No live market data.</p>
          )}
        </div>

        {description && (
          <p className="mt-2.5 line-clamp-2 text-[13px] text-ink-dim">{description}</p>
        )}

        {list_of_links && list_of_links.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {list_of_links.map((link, index) => (
              <span
                key={index}
                className="rounded-full border border-line bg-bg-soft px-2.5 py-0.5 text-xs text-ink-dim"
              >
                {link.label || link.type || "link"}
              </span>
            ))}
          </div>
        )}

        {footer && (
          <div
            className="mt-auto pt-3"
            onClick={(event) => {
              // The whole card is a link; keep footer actions from navigating.
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </Link>
  );
}
