/**
 * Vercel Edge Middleware — dynamic Open Graph / Twitter cards for token pages.
 *
 * Social crawlers (Twitter/X, Discord, Telegram, Slack, Facebook, LinkedIn, …)
 * do not execute JavaScript, so a Vite SPA's client-side render never reaches
 * them. When a bot hits `/token/:chainId/:address`, we short-circuit and return
 * a tiny HTML document with token-specific og:/twitter: meta tags (name, symbol,
 * price blurb, logo / open-graph image). Humans pass through to the SPA.
 */

import { next } from "@vercel/edge";

/** User-Agent substrings that identify link-preview crawlers (not general search bots). */
const BOT_UA =
  /Twitterbot|facebookexternalhit|Facebot|Slackbot|Discordbot|TelegramBot|LinkedInBot|WhatsApp|SkypeUriPreview|Pinterest|redditbot|Embedly|Quora\s+Link\s+Preview|Showyoubot|outbrain|vkShare|MetaInspector|Iframely|Slack-ImgProxy|Discord-Preview|Twitter\s+bot/i;

/** Torch chain id → Dexscreener chain slug (keep in sync with src/lib/chains.ts). */
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

const CHAIN_NAME: Record<string, string> = {
  solana: "Solana",
  ethereum: "Ethereum",
  base: "Base",
  arbitrum: "Arbitrum",
  bsc: "BNB Chain",
  polygon: "Polygon",
  optimism: "Optimism",
  avalanche: "Avalanche",
};

export const config = {
  matcher: "/token/:chainId/:address",
};

interface TokenCard {
  name: string;
  symbol: string;
  chainId: string;
  chainName: string;
  address: string;
  description: string;
  imageUrl: string;
  /** Prefer large card when we have a wide OG image; otherwise summary (logo). */
  card: "summary_large_image" | "summary";
  priceUsd?: number;
  marketCap?: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shortenAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function formatUsd(n: number | undefined): string | null {
  if (n === undefined || !Number.isFinite(n)) return null;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.0001) return `$${n.toFixed(4)}`;
  return `$${n.toPrecision(3)}`;
}

function isBot(ua: string | null): boolean {
  return Boolean(ua && BOT_UA.test(ua));
}

function deepestPair(pairs: any[], dexSlug: string): any | null {
  const onChain = pairs.filter((p) => p?.chainId === dexSlug);
  if (onChain.length === 0) return null;
  return onChain.reduce((a, b) =>
    Number(b?.liquidity?.usd ?? 0) > Number(a?.liquidity?.usd ?? 0) ? b : a
  );
}

async function fetchDexToken(chainId: string, address: string): Promise<{
  name?: string;
  symbol?: string;
  imageUrl?: string;
  priceUsd?: number;
  marketCap?: number;
} | null> {
  const dexSlug = DEX_SLUG[chainId];
  if (!dexSlug) return null;
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { pairs?: any[] };
    const pairs = Array.isArray(body?.pairs) ? body.pairs : [];
    const best = deepestPair(pairs, dexSlug);
    if (!best) return null;
    const info = best.info ?? {};
    const base = best.baseToken ?? {};
    return {
      name: typeof base.name === "string" ? base.name : undefined,
      symbol: typeof base.symbol === "string" ? base.symbol : undefined,
      imageUrl: typeof info.imageUrl === "string" ? info.imageUrl : undefined,
      priceUsd: Number(best.priceUsd),
      marketCap: Number(best.marketCap ?? best.fdv),
    };
  } catch {
    return null;
  }
}

async function fetchTorchProfile(
  apiBase: string,
  chainId: string,
  address: string
): Promise<{ description?: string; icon?: string; header?: string } | null> {
  if (!apiBase) return null;
  try {
    const res = await fetch(`${apiBase}/token-profiles/${chainId}/${address}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      description?: string | null;
      icon?: string | null;
      header?: string | null;
    };
    return {
      description: body.description ?? undefined,
      icon: body.icon ?? undefined,
      header: body.header ?? undefined,
    };
  } catch {
    return null;
  }
}

async function buildCard(
  origin: string,
  chainId: string,
  address: string
): Promise<TokenCard> {
  const chainName = CHAIN_NAME[chainId] ?? chainId;
  const apiBase = (process.env.VITE_API_BASE || "").replace(/\/$/, "");

  const [dex, profile] = await Promise.all([
    fetchDexToken(chainId, address),
    fetchTorchProfile(apiBase, chainId, address),
  ]);

  const name = dex?.name || profile?.description?.slice(0, 40) || shortenAddress(address);
  const symbol = dex?.symbol || "";
  const displayName = symbol ? `${name} ($${symbol})` : name;

  const blurbParts: string[] = [];
  const price = formatUsd(dex?.priceUsd);
  const mcap = formatUsd(dex?.marketCap);
  if (price) blurbParts.push(`Price ${price}`);
  if (mcap) blurbParts.push(`MC ${mcap}`);
  blurbParts.push(`on ${chainName}`);

  const marketLine = blurbParts.join(" · ");
  const description =
    (profile?.description && profile.description.trim()) ||
    `${displayName} ${marketLine}. Free enhanced token info on Torch.`;

  // Always use our Torch-branded OG image endpoint — never Dexscreener's
  // pre-rendered card (it bakes in their logo).
  const imageUrl = `${origin}/api/og?chainId=${encodeURIComponent(chainId)}&address=${encodeURIComponent(address)}`;

  return {
    name: displayName,
    symbol,
    chainId,
    chainName,
    address,
    description: description.slice(0, 280),
    imageUrl,
    card: "summary_large_image",
    priceUsd: dex?.priceUsd,
    marketCap: dex?.marketCap,
  };
}

function renderHtml(origin: string, path: string, card: TokenCard): string {
  const url = `${origin}${path}`;
  const title = `${card.name} on Torch`;
  const desc = card.description;
  const image = card.imageUrl;
  const t = escapeHtml(title);
  const d = escapeHtml(desc);
  const i = escapeHtml(image);
  const u = escapeHtml(url);
  const site = escapeHtml(origin);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${t}</title>
  <meta name="description" content="${d}" />
  <link rel="canonical" href="${u}" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Torch" />
  <meta property="og:title" content="${t}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:url" content="${u}" />
  <meta property="og:image" content="${i}" />
  <meta property="og:image:secure_url" content="${i}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${t}" />

  <meta name="twitter:card" content="${card.card}" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${i}" />
  <meta name="twitter:image:alt" content="${t}" />

  <meta http-equiv="refresh" content="0;url=${u}" />
  <link rel="icon" type="image/svg+xml" href="${site}/favicon.svg" />
</head>
<body>
  <p><a href="${u}">${t}</a></p>
  <p>${d}</p>
</body>
</html>`;
}

export default async function middleware(request: Request): Promise<Response> {
  const ua = request.headers.get("user-agent");
  if (!isBot(ua)) {
    // Humans: fall through to the SPA rewrite.
    return next();
  }

  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  // ["token", chainId, address]
  if (parts.length < 3 || parts[0] !== "token") {
    return next();
  }

  const chainId = parts[1].toLowerCase();
  const address = parts[2];
  if (!DEX_SLUG[chainId] || !address) {
    return next();
  }

  const origin = url.origin;
  const path = `/token/${chainId}/${address}`;

  try {
    const card = await buildCard(origin, chainId, address);
    const html = renderHtml(origin, path, card);
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // Short cache so price/description stay fresh, but bots don't hammer us.
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch {
    // On any failure, don't break the share — serve the SPA / default tags.
    return next();
  }
}
