import { useState } from "react";
import {
  formatPercent,
  type MarketPair,
  type TokenBrief,
} from "../../lib/market";
import type { TokenLink } from "../../lib/types";

/**
 * The normalized shape every shared token view (card + list) renders from, so
 * the live feed and the watchlist can display the exact same UI from whatever
 * data each page happens to have on hand.
 */
export interface TokenViewItem {
  address: string;
  market: MarketPair | null | undefined;
  brief: TokenBrief | undefined;
  /** Banner image shown at the top of a card. Live-feed profiles have one. */
  headerImageUrl?: string | null;
  /** Extra logo fallback used when the brief and market both lack one. */
  iconFallback?: string | null;
  description?: string | null;
  list_of_links?: TokenLink[];
  /** ISO timestamp of the last profile update, shown as relative time. */
  updatedAt?: string | null;
  /** Briefly highlights the row/card right after a live update. */
  isFresh?: boolean;
}

export interface TokenIdentity {
  iconUrl: string | null;
  name: string;
  symbol: string;
  isPriceUp: boolean;
}

/** Pick the best available name, symbol and logo for a token view item. */
export function resolveTokenIdentity(item: TokenViewItem): TokenIdentity {
  const iconUrl =
    item.brief?.imageUrl ?? item.market?.imageUrl ?? item.iconFallback ?? null;
  const name = item.brief?.name?.trim() || item.market?.baseName?.trim() || "";
  const symbol = item.brief?.symbol?.trim() || item.market?.baseSymbol?.trim() || "";
  return {
    iconUrl,
    name,
    symbol,
    isPriceUp: (item.market?.priceChange.h24 ?? 0) >= 0,
  };
}

/** Deterministic hue so a logo-less token always gets the same gradient. */
function hueFromSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  }
  return hash;
}

interface TokenAvatarProps {
  iconUrl: string | null;
  symbol: string;
  /** Stable string (usually the address) used to pick the fallback color. */
  seed: string;
  /** Sizing classes for the avatar box. */
  className?: string;
  /** Text size class for the initials fallback. */
  textClassName?: string;
}

/**
 * Token logo with a graceful fallback: shows the real icon when available,
 * otherwise a colored gradient chip with the token's initials. Also recovers
 * when a remote logo URL fails to load.
 */
export function TokenAvatar({
  iconUrl,
  symbol,
  seed,
  className = "h-9 w-9",
  textClassName = "text-[11px]",
}: TokenAvatarProps) {
  const [hasImageFailed, setHasImageFailed] = useState(false);
  const initials = symbol.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "?";

  if (iconUrl && !hasImageFailed) {
    return (
      <img
        src={iconUrl}
        alt=""
        loading="lazy"
        onError={() => setHasImageFailed(true)}
        className={`shrink-0 rounded-full bg-bg-soft object-cover ring-1 ring-line ${className}`}
      />
    );
  }

  const hue = hueFromSeed(seed);
  return (
    <span
      aria-hidden="true"
      style={{
        backgroundImage: `linear-gradient(135deg, hsl(${hue} 68% 55%), hsl(${(hue + 48) % 360} 70% 45%))`,
      }}
      className={`grid shrink-0 place-items-center rounded-full font-mono font-bold text-white ${textClassName} ${className}`}
    >
      {initials}
    </span>
  );
}

interface PriceChangeBadgeProps {
  value: number;
  /** Appends a subtle "24h" label (used on cards, hidden in the dense table). */
  showTimeframeLabel?: boolean;
}

/** Signed 24h price change as a colored pill with a trend arrow. */
export function PriceChangeBadge({ value, showTimeframeLabel = true }: PriceChangeBadgeProps) {
  const isPriceUp = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
        isPriceUp ? "bg-up/10 text-up" : "bg-down/10 text-down"
      }`}
    >
      <TrendArrow up={isPriceUp} className="h-3 w-3" />
      {formatPercent(value)}
      {showTimeframeLabel && <span className="ml-0.5 font-normal opacity-70">24h</span>}
    </span>
  );
}

function TrendArrow({ up, className }: { up: boolean; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {up ? <path d="M6 15l6-6 6 6" /> : <path d="M6 9l6 6 6-6" />}
    </svg>
  );
}
