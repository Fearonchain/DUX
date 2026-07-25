/**
 * Dynamic Open Graph image for token share cards.
 *
 * Layout mirrors the familiar Dexscreener share card (banner + avatar + stats)
 * but brands with Torch's flame mark instead of theirs.
 *
 *   GET /api/og?chainId=solana&address=<mint>
 */

import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

const DEX_SLUG: Record<string, string> = {
  solana: "solana",
  ethereum: "ethereum",
  base: "base",
  arbitrum: "arbitrum",
  bsc: "bsc",
  polygon: "polygon",
  optimism: "optimism",
  avalanche: "avalanche",
};

const CHAIN_LABEL: Record<string, string> = {
  solana: "SOL",
  ethereum: "ETH",
  base: "BASE",
  arbitrum: "ARB",
  bsc: "BNB",
  polygon: "POL",
  optimism: "OP",
  avalanche: "AVAX",
};

function formatUsd(n: number | undefined | null): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.0001) return `$${n.toFixed(4)}`;
  return `$${n.toPrecision(3)}`;
}

function formatPct(n: number | undefined | null): { text: string; color: string } {
  if (n === undefined || n === null || !Number.isFinite(n)) {
    return { text: "", color: "#94a3b8" };
  }
  const sign = n > 0 ? "+" : "";
  return {
    text: `${sign}${n.toFixed(2)}%`,
    color: n > 0 ? "#22c55e" : n < 0 ? "#ef4444" : "#94a3b8",
  };
}

function deepestPair(pairs: any[], dexSlug: string): any | null {
  const onChain = pairs.filter((p) => p?.chainId === dexSlug);
  if (onChain.length === 0) return null;
  return onChain.reduce((a, b) =>
    Number(b?.liquidity?.usd ?? 0) > Number(a?.liquidity?.usd ?? 0) ? b : a
  );
}

async function fetchToken(chainId: string, address: string) {
  const dexSlug = DEX_SLUG[chainId];
  if (!dexSlug) return null;
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { pairs?: any[] };
    const best = deepestPair(Array.isArray(body?.pairs) ? body.pairs : [], dexSlug);
    if (!best) return null;
    const info = best.info ?? {};
    const base = best.baseToken ?? {};
    return {
      name: (base.name as string) || "Unknown",
      symbol: (base.symbol as string) || "",
      imageUrl: typeof info.imageUrl === "string" ? info.imageUrl : null,
      headerUrl: typeof info.header === "string" ? info.header : null,
      priceUsd: Number(best.priceUsd),
      marketCap: Number(best.marketCap ?? best.fdv),
      volume24h: Number(best.volume?.h24),
      liquidity: Number(best.liquidity?.usd),
      change24h: Number(best.priceChange?.h24),
    };
  } catch {
    return null;
  }
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const chainId = (url.searchParams.get("chainId") || "solana").toLowerCase();
  const address = url.searchParams.get("address") || "";
  const origin = url.origin;

  if (!address || !DEX_SLUG[chainId]) {
    return new Response("Missing chainId or address", { status: 400 });
  }

  const token = await fetchToken(chainId, address);
  const name = token?.name || address.slice(0, 6);
  const symbol = token?.symbol || "";
  const chainLabel = CHAIN_LABEL[chainId] || chainId.toUpperCase();
  const mcap = formatUsd(token?.marketCap);
  const vol = formatUsd(token?.volume24h);
  const liq = formatUsd(token?.liquidity);
  const pct = formatPct(token?.change24h);
  const torchIcon = `${origin}/torch-icon.png`;
  const avatar = token?.imageUrl;
  const header = token?.headerUrl;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0b0f14",
          color: "#f8fafc",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        {/* Banner */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: 360,
            display: "flex",
            overflow: "hidden",
            background: header
              ? "#0b0f14"
              : "linear-gradient(135deg, #1a1433 0%, #0b0f14 50%, #1e1b4b 100%)",
          }}
        >
          {header ? (
            <img
              src={header}
              alt=""
              width={1200}
              height={360}
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : null}
          {/* Bottom fade so avatar/logo sit cleanly */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 120,
              background: "linear-gradient(to top, #0b0f14, transparent)",
              display: "flex",
            }}
          />

          {/* Avatar + chain */}
          <div
            style={{
              position: "absolute",
              left: 48,
              bottom: 24,
              display: "flex",
              alignItems: "flex-end",
              gap: 14,
            }}
          >
            <div
              style={{
                width: 112,
                height: 112,
                borderRadius: 999,
                overflow: "hidden",
                border: "4px solid #0b0f14",
                background: "#1e293b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {avatar ? (
                <img
                  src={avatar}
                  alt=""
                  width={112}
                  height={112}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div style={{ fontSize: 48, displayContent: "center", display: "flex" }}>?</div>
              )}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(15, 23, 42, 0.85)",
                border: "1px solid rgba(148, 163, 184, 0.25)",
                borderRadius: 999,
                padding: "8px 14px",
                marginBottom: 8,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.04em",
                color: "#e2e8f0",
              }}
            >
              {chainLabel}
            </div>
          </div>

          {/* Torch brand mark — replaces Dexscreener's owl */}
          <div
            style={{
              position: "absolute",
              right: 40,
              bottom: 28,
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "rgba(11, 15, 20, 0.72)",
              border: "1px solid rgba(109, 94, 252, 0.45)",
              borderRadius: 999,
              padding: "10px 18px 10px 10px",
            }}
          >
            <img
              src={torchIcon}
              alt="Torch"
              width={48}
              height={48}
              style={{ width: 48, height: 48, borderRadius: 12 }}
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: "#f8fafc",
                lineHeight: 1,
              }}
            >
              torch
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            flex: 1,
            padding: "28px 48px 36px",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 32,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 420 }}>
            <div
              style={{
                fontSize: 64,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1,
                color: "#f8fafc",
              }}
            >
              {symbol || name}
            </div>
            {symbol ? (
              <div style={{ fontSize: 28, color: "#94a3b8", fontWeight: 500 }}>{name}</div>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: 48, alignItems: "flex-start" }}>
            <Stat label="MCAP" value={mcap} sub={pct.text} subColor={pct.color} />
            <Stat label="24H VOL" value={vol} />
            <Stat label="LIQUIDITY" value={liq} />
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}

function Stat({
  label,
  value,
  sub,
  subColor,
}: {
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 140 }}>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "0.08em",
          color: "#64748b",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <div style={{ fontSize: 36, fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.02em" }}>
          {value}
        </div>
        {sub ? (
          <div style={{ fontSize: 22, fontWeight: 700, color: subColor || "#94a3b8" }}>{sub}</div>
        ) : null}
      </div>
    </div>
  );
}
