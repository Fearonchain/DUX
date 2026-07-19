/**
 * Live market data for a Solana token.
 *
 * Profiles (banner/description/links) come from the DUX backend. Trading data
 * — price, liquidity, market cap, buys/sells, candles and recent trades — is
 * pulled from free, public, key-less sources so any token works out of the box:
 *
 *   - Dexscreener token API  → aggregate pair stats
 *   - GeckoTerminal API      → OHLCV candles + individual recent trades
 *
 * Everything here is read-only and safe to call from the browser.
 */

const DEXSCREENER_BASE = "https://api.dexscreener.com/latest/dex";
const GECKOTERMINAL_BASE = "https://api.geckoterminal.com/api/v2";
const JUPITER_TOKEN_BASE = "https://lite-api.jup.ag/tokens/v2";
const NETWORK = "solana";

export interface TxnBuckets {
  buys: number;
  sells: number;
}

export interface MarketPair {
  pairAddress: string;
  dexId: string;
  url: string;
  baseSymbol: string;
  baseName: string;
  quoteSymbol: string;
  imageUrl: string | null;
  priceUsd: number;
  priceNative: number;
  priceChange: { m5: number; h1: number; h6: number; h24: number };
  txns: { m5: TxnBuckets; h1: TxnBuckets; h6: TxnBuckets; h24: TxnBuckets };
  volume: { m5: number; h1: number; h6: number; h24: number };
  liquidityUsd: number;
  fdv: number;
  marketCap: number;
  pairCreatedAt: number | null;
}

export interface Trade {
  id: string;
  kind: "buy" | "sell";
  amountUsd: number;
  baseAmount: number;
  quoteAmount: number;
  priceUsd: number;
  wallet: string;
  txHash: string;
  timestamp: number; // unix seconds
}

function toNumber(value: unknown): number {
  const n = typeof value === "string" ? parseFloat(value) : (value as number);
  return Number.isFinite(n) ? n : 0;
}

/** Dexscreener accepts up to 30 comma-separated token addresses per request. */
const DEXSCREENER_BATCH_SIZE = 30;

/** Shape a raw Dexscreener pair row into our typed MarketPair. */
function mapDexscreenerPair(raw: any): MarketPair {
  return {
    pairAddress: raw.pairAddress,
    dexId: raw.dexId ?? "",
    url: raw.url ?? "",
    baseSymbol: raw.baseToken?.symbol ?? "TOKEN",
    baseName: raw.baseToken?.name ?? "Unknown token",
    quoteSymbol: raw.quoteToken?.symbol ?? "SOL",
    imageUrl: raw.info?.imageUrl ?? null,
    priceUsd: toNumber(raw.priceUsd),
    priceNative: toNumber(raw.priceNative),
    priceChange: {
      m5: toNumber(raw.priceChange?.m5),
      h1: toNumber(raw.priceChange?.h1),
      h6: toNumber(raw.priceChange?.h6),
      h24: toNumber(raw.priceChange?.h24),
    },
    txns: {
      m5: { buys: toNumber(raw.txns?.m5?.buys), sells: toNumber(raw.txns?.m5?.sells) },
      h1: { buys: toNumber(raw.txns?.h1?.buys), sells: toNumber(raw.txns?.h1?.sells) },
      h6: { buys: toNumber(raw.txns?.h6?.buys), sells: toNumber(raw.txns?.h6?.sells) },
      h24: { buys: toNumber(raw.txns?.h24?.buys), sells: toNumber(raw.txns?.h24?.sells) },
    },
    volume: {
      m5: toNumber(raw.volume?.m5),
      h1: toNumber(raw.volume?.h1),
      h6: toNumber(raw.volume?.h6),
      h24: toNumber(raw.volume?.h24),
    },
    liquidityUsd: toNumber(raw.liquidity?.usd),
    fdv: toNumber(raw.fdv),
    marketCap: toNumber(raw.marketCap),
    pairCreatedAt: raw.pairCreatedAt ? Number(raw.pairCreatedAt) : null,
  };
}

/** Pick the deepest (most liquid) Solana pair from a list of raw pair rows. */
function deepestSolanaPair(pairs: any[]): any | null {
  const solanaPairs = pairs.filter((p) => p?.chainId === NETWORK);
  if (solanaPairs.length === 0) return null;
  return solanaPairs.reduce((a, b) =>
    toNumber(b?.liquidity?.usd) > toNumber(a?.liquidity?.usd) ? b : a
  );
}

/** Fetch the deepest (most liquid) Solana pair for a token from Dexscreener. */
export async function fetchMarketPair(tokenAddress: string): Promise<MarketPair | null> {
  const res = await fetch(`${DEXSCREENER_BASE}/tokens/${tokenAddress}`, { cache: "no-store" });
  if (!res.ok) return null;
  const body = await res.json();
  const pairs: any[] = Array.isArray(body?.pairs) ? body.pairs : [];
  const best = deepestSolanaPair(pairs);
  return best ? mapDexscreenerPair(best) : null;
}

/**
 * Fetch the deepest Solana pair for many tokens at once.
 *
 * Dexscreener's `/tokens/{a,b,c,...}` endpoint returns pairs for up to 30
 * addresses per request, so the whole feed resolves in a handful of batched
 * requests instead of one request per token. This keeps the live feed from
 * hammering the API (and tripping its rate limit) when many charts are on
 * screen at once. Tokens with no Solana pair are returned as `null` so callers
 * can distinguish "checked, none found" from "not fetched yet".
 */
export async function fetchMarketPairs(
  addresses: string[]
): Promise<Record<string, MarketPair | null>> {
  const unique = [...new Set(addresses)];
  const marketByAddress: Record<string, MarketPair | null> = {};
  for (const address of unique) marketByAddress[address] = null;
  if (unique.length === 0) return marketByAddress;

  const batches: string[][] = [];
  for (let i = 0; i < unique.length; i += DEXSCREENER_BATCH_SIZE) {
    batches.push(unique.slice(i, i + DEXSCREENER_BATCH_SIZE));
  }

  await Promise.all(
    batches.map(async (batch) => {
      try {
        const res = await fetch(`${DEXSCREENER_BASE}/tokens/${batch.join(",")}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const body = await res.json();
        const pairs: any[] = Array.isArray(body?.pairs) ? body.pairs : [];

        // Group every returned pair under the base token it belongs to.
        const pairsByAddress: Record<string, any[]> = {};
        for (const pair of pairs) {
          const address = pair?.baseToken?.address as string | undefined;
          if (!address) continue;
          (pairsByAddress[address] ??= []).push(pair);
        }

        for (const address of batch) {
          const best = deepestSolanaPair(pairsByAddress[address] ?? []);
          if (best) marketByAddress[address] = mapDexscreenerPair(best);
        }
      } catch {
        /* transient error — these tokens simply stay null this pass */
      }
    })
  );

  return marketByAddress;
}

/** A single token surfaced by the platform-wide command-palette search. */
export interface TokenSearchResult {
  address: string;
  name: string;
  symbol: string;
  imageUrl: string | null;
  priceUsd: number;
  priceChange24h: number;
  liquidityUsd: number;
  marketCap: number;
}

/**
 * Search Solana tokens by name, symbol or address for the global command
 * palette. Backed by Dexscreener's public, key-less `/search` endpoint, which
 * matches against token identity and returns matching pairs.
 *
 * A token can trade in many pairs, so we collapse every returned pair down to
 * one row per base-token address, keeping the deepest (most liquid) pair as the
 * canonical price/identity for that token, then rank the tokens by liquidity so
 * the most relevant, tradeable results float to the top.
 */
export async function searchTokens(query: string): Promise<TokenSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  let body: any;
  try {
    const res = await fetch(`${DEXSCREENER_BASE}/search?q=${encodeURIComponent(trimmed)}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    body = await res.json();
  } catch {
    return [];
  }

  const pairs: any[] = Array.isArray(body?.pairs) ? body.pairs : [];
  const bestByAddress = new Map<string, any>();
  for (const pair of pairs) {
    if (pair?.chainId !== NETWORK) continue;
    const address = pair?.baseToken?.address as string | undefined;
    if (!address) continue;
    const current = bestByAddress.get(address);
    if (!current || toNumber(pair?.liquidity?.usd) > toNumber(current?.liquidity?.usd)) {
      bestByAddress.set(address, pair);
    }
  }

  return [...bestByAddress.values()]
    .map((pair) => ({
      address: pair.baseToken.address as string,
      name: pair.baseToken?.name ?? "",
      symbol: pair.baseToken?.symbol ?? "",
      imageUrl: pair.info?.imageUrl ?? null,
      priceUsd: toNumber(pair.priceUsd),
      priceChange24h: toNumber(pair.priceChange?.h24),
      liquidityUsd: toNumber(pair.liquidity?.usd),
      marketCap: toNumber(pair.marketCap),
    }))
    .sort((a, b) => b.liquidityUsd - a.liquidityUsd);
}

export interface TokenBrief {
  name: string;
  symbol: string;
  imageUrl: string | null;
}

/**
 * Fetch name / symbol / icon for many tokens in a single pass. Used by the
 * "just added" marquee and the live feed so they can show real names and logos
 * instead of raw addresses.
 *
 * Both sources are public, key-less and CORS-enabled (so they work directly
 * from the browser):
 *
 *   - Jupiter token API → on-chain token metadata, including the logo (`icon`);
 *     the widest, freshest coverage for Solana tokens (incl. pump.fun launches)
 *   - Dexscreener       → most-liquid-pair name/symbol, used as a fallback
 *
 * Jupiter supplies the logo and identity; Dexscreener backfills any token
 * Jupiter has not indexed yet.
 */
export async function fetchTokenBriefs(
  addresses: string[]
): Promise<Record<string, TokenBrief>> {
  const unique = [...new Set(addresses)].slice(0, 30);
  if (unique.length === 0) return {};

  const [jupiterBriefs, dexBriefs] = await Promise.all([
    fetchJupiterBriefs(unique),
    fetchDexscreenerBriefs(unique),
  ]);

  const merged: Record<string, TokenBrief> = {};
  for (const address of unique) {
    const jup = jupiterBriefs[address];
    const dex = dexBriefs[address];
    if (!jup && !dex) continue;
    merged[address] = {
      name: jup?.name || dex?.name || "",
      symbol: jup?.symbol || dex?.symbol || "",
      // Prefer Jupiter's on-chain logo; fall back to a Dexscreener pair logo.
      imageUrl: jup?.imageUrl ?? dex?.imageUrl ?? null,
    };
  }
  return merged;
}

/** Token metadata (incl. logo) per token from Jupiter's token search API. */
async function fetchJupiterBriefs(
  addresses: string[]
): Promise<Record<string, TokenBrief>> {
  try {
    const res = await fetch(`${JUPITER_TOKEN_BASE}/search?query=${addresses.join(",")}`, {
      cache: "no-store",
    });
    if (!res.ok) return {};
    const body = await res.json();
    const rows: any[] = Array.isArray(body) ? body : [];

    const briefsByAddress: Record<string, TokenBrief> = {};
    for (const row of rows) {
      const address = row?.id as string | undefined;
      if (!address) continue;
      briefsByAddress[address] = {
        name: row.name ?? "",
        symbol: row.symbol ?? "",
        imageUrl: typeof row.icon === "string" && row.icon ? row.icon : null,
      };
    }
    return briefsByAddress;
  } catch {
    return {};
  }
}

/** Most-liquid-pair metadata per token from Dexscreener (one batch request). */
async function fetchDexscreenerBriefs(
  addresses: string[]
): Promise<Record<string, TokenBrief>> {
  try {
    const res = await fetch(`${DEXSCREENER_BASE}/tokens/${addresses.join(",")}`, {
      cache: "no-store",
    });
    if (!res.ok) return {};
    const body = await res.json();
    const pairs: any[] = Array.isArray(body?.pairs) ? body.pairs : [];

    const bestByAddress: Record<string, { brief: TokenBrief; liquidity: number }> = {};
    for (const pair of pairs) {
      if (pair?.chainId !== NETWORK) continue;
      const address = pair?.baseToken?.address as string | undefined;
      if (!address) continue;
      const liquidity = toNumber(pair?.liquidity?.usd);
      const current = bestByAddress[address];
      if (!current || liquidity > current.liquidity) {
        bestByAddress[address] = {
          liquidity,
          brief: {
            name: pair.baseToken?.name ?? "",
            symbol: pair.baseToken?.symbol ?? "",
            imageUrl: pair.info?.imageUrl ?? null,
          },
        };
      }
    }

    const briefsByAddress: Record<string, TokenBrief> = {};
    for (const [address, value] of Object.entries(bestByAddress)) {
      briefsByAddress[address] = value.brief;
    }
    return briefsByAddress;
  } catch {
    return {};
  }
}

/**
 * Reconstruct a lightweight price trend for a sparkline using only the data
 * Dexscreener already returns (one request per token, no extra API calls).
 * Each priceChange bucket is the trailing % move ending "now", so we can walk
 * backwards to approximate the price at each checkpoint.
 */
export function sparkPointsFromPair(pair: MarketPair): number[] {
  const now = pair.priceUsd;
  const { h24, h6, h1, m5 } = pair.priceChange;
  const at = (changePct: number) => now / (1 + changePct / 100);
  return [at(h24), at(h6), at(h1), at(m5), now].filter(
    (n) => Number.isFinite(n) && n > 0
  );
}

/** Fetch the most recent individual trades for a pool. */
export async function fetchTrades(pairAddress: string): Promise<Trade[]> {
  const url = `${GECKOTERMINAL_BASE}/networks/${NETWORK}/pools/${pairAddress}/trades`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json;version=20230302" },
  });
  if (!res.ok) return [];
  const body = await res.json();
  const rows: any[] = Array.isArray(body?.data) ? body.data : [];

  return rows.map((row) => {
    const a = row.attributes ?? {};
    const kind: "buy" | "sell" = a.kind === "sell" ? "sell" : "buy";
    return {
      id: String(row.id ?? a.tx_hash ?? Math.random()),
      kind,
      amountUsd: toNumber(a.volume_in_usd),
      baseAmount: toNumber(kind === "buy" ? a.to_token_amount : a.from_token_amount),
      quoteAmount: toNumber(kind === "buy" ? a.from_token_amount : a.to_token_amount),
      priceUsd: toNumber(kind === "buy" ? a.price_to_in_usd : a.price_from_in_usd),
      wallet: a.tx_from_address ?? "",
      txHash: a.tx_hash ?? "",
      timestamp: a.block_timestamp ? Math.floor(new Date(a.block_timestamp).getTime() / 1000) : 0,
    };
  });
}

/* ---------------------------------------------------------------------------
 * Formatting helpers — small, dependency-free, shared across the dashboard.
 * ------------------------------------------------------------------------- */

const SUBSCRIPTS = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];

function toSubscript(n: number): string {
  return String(n)
    .split("")
    .map((d) => SUBSCRIPTS[Number(d)] ?? d)
    .join("");
}

/**
 * Format a USD price the way trading terminals do. Tiny prices collapse their
 * leading zeros into a subscript count, e.g. 0.0000567 → "$0.0₄567".
 */
export function formatPriceUsd(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return "$0.00";
  if (price >= 1) return `$${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (price >= 0.001) return `$${price.toFixed(4)}`;

  const decimals = price.toExponential().split("e-")[1];
  const leadingZeros = Number(decimals) - 1;
  const significant = Math.round(price * 10 ** (leadingZeros + 4))
    .toString()
    .replace(/0+$/, "")
    .padStart(1, "0");
  return `$0.0${toSubscript(leadingZeros)}${significant}`;
}

/** Compact money: 1_234_567 → "$1.23M". */
export function formatUsdCompact(value: number): string {
  if (!Number.isFinite(value)) return "$0";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

/** Compact plain number: 1_234_567 → "1.23M". */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/** Signed percentage: 12.34 → "+12.34%". */
export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0.00%";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function relTimeShort(timestampSeconds: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - timestampSeconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
