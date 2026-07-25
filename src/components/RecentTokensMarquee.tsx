import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "../lib/config";
import { relTime, shortenAddress, type TokenProfile } from "../lib/types";
import { fetchTokenBriefs, type TokenBrief } from "../lib/market";
import { Skeleton } from "./ui/Skeleton";

/** Auto-scrolling strip of the most recently added token profiles. */
export default function RecentTokensMarquee() {
  const [tokens, setTokens] = useState<TokenProfile[]>([]);
  const [briefs, setBriefs] = useState<Record<string, TokenBrief>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/token-profiles/latest/v1`, { cache: "no-store" });
        if (!res.ok || stop) return;
        const data: TokenProfile[] = await res.json();
        const latest = Array.isArray(data) ? data.slice(0, 20) : [];
        if (stop) return;
        setTokens(latest);

        // Enrich with real names / logos from the market APIs. Group by chain
        // so each chain's briefs come from the right per-provider slug.
        const byChain = new Map<string, string[]>();
        for (const t of latest) {
          const list = byChain.get(t.chainId) ?? [];
          list.push(t.tokenAddress);
          byChain.set(t.chainId, list);
        }
        const maps = await Promise.all(
          [...byChain.entries()].map(([chainId, addresses]) =>
            fetchTokenBriefs(addresses, chainId)
          )
        );
        if (!stop) setBriefs(Object.assign({}, ...maps));
      } catch {
        /* transient error, ignore */
      } finally {
        if (!stop) setLoading(false);
      }
    }
    load();
    const iv = setInterval(load, 30000);
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, []);

  if (tokens.length === 0) {
    if (!loading) return null;
    return (
      <div className="relative overflow-hidden rounded-xl border border-line bg-card">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center gap-2 bg-gradient-to-r from-card via-card to-transparent pl-3 pr-10">
          <span className="h-2 w-2 animate-pulse-dot rounded-full bg-brand" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-brand">Just added</span>
        </div>
        <div className="flex items-center gap-2.5 py-2.5 pl-[130px]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-bg-soft px-3 py-1.5"
            >
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-3 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Two identical halves so the -50% keyframe loops seamlessly.
  const halves = [tokens, tokens];
  const duration = Math.max(24, tokens.length * 3.5);

  return (
    <div className="group relative overflow-hidden rounded-xl border border-line bg-card">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center gap-2 bg-gradient-to-r from-card via-card to-transparent pl-3 pr-10">
        <span className="h-2 w-2 animate-pulse-dot rounded-full bg-brand" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-brand">Just added</span>
      </div>

      <div
        className="flex w-max animate-marquee items-center group-hover:[animation-play-state:paused]"
        style={{ animationDuration: `${duration}s` }}
      >
        {halves.map((group, half) => (
          <div
            key={half}
            aria-hidden={half === 1}
            className="flex shrink-0 items-center gap-2.5 py-2.5 pl-2.5"
          >
            {group.map((t, i) => {
              const brief = briefs[t.tokenAddress];
              const image = brief?.imageUrl ?? t.icon;
              const name = brief?.name?.trim();
              const symbol = brief?.symbol?.trim();
              const label = name || symbol || shortenAddress(t.tokenAddress);
              // Monogram uses the real name/symbol when known, else the address.
              const monogram = (name || symbol || t.tokenAddress).slice(0, 2).toUpperCase();
              return (
                <Link
                  key={`${t.chainId}:${t.tokenAddress}-${i}`}
                  to={`/token/${t.chainId}/${t.tokenAddress}`}
                  className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-bg-soft px-3 py-1.5 transition hover:border-brand hover:bg-brand-soft"
                >
                  {image ? (
                    <img
                      src={image}
                      alt=""
                      loading="lazy"
                      className="h-5 w-5 rounded-full bg-card object-cover"
                    />
                  ) : (
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-soft font-mono text-[9px] font-bold text-brand">
                      {monogram}
                    </span>
                  )}
                  <span className="max-w-[160px] truncate text-xs font-semibold text-ink">
                    {label}
                  </span>
                  {symbol && name && (
                    <span className="font-mono text-[10px] uppercase text-ink-dim">{symbol}</span>
                  )}
                  <span className="text-[10px] text-ink-dim">{relTime(t.updatedAt)}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
