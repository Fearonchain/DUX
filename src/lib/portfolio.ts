/**
 * Wallet portfolio data layer.
 *
 * Reads the SOL + SPL token balances held by a connected wallet straight from
 * the chain (public RPC, read-only), then enriches every holding with live
 * price / 24h change from the same key-less market sources the rest of DUX
 * uses (Dexscreener, with a Jupiter fallback) and on-chain names / logos.
 *
 * Everything here is read-only and safe to call from the browser: we only ever
 * query balances and public price data, never sign or send transactions.
 */

import {
  fetchMarketPairsResilient,
  fetchTokenBriefs,
  type MarketPair,
  type TokenBrief,
} from "./market";

/** Native SOL is priced via its wrapped-SOL mint on every market source. */
export const WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112";

/**
 * Keyless balances source (Jupiter Ultra). We deliberately avoid a raw RPC
 * `getParsedTokenAccountsByOwner` call here: the public Solana RPC endpoints
 * reject that method (it's in the restricted `getProgramAccounts` family), so
 * relying on it means the portfolio only ever works against a paid RPC. This
 * endpoint returns SOL + every SPL / Token-2022 balance in one keyless,
 * CORS-friendly request — the same public-source philosophy the rest of the
 * market data layer uses.
 */
const JUPITER_ULTRA_BASE = "https://lite-api.jup.ag/ultra/v1";

/** A raw balance the wallet holds, before any price/identity enrichment. */
export interface WalletBalance {
  mint: string;
  /** Human amount, already scaled down by the token's decimals. */
  amount: number;
  decimals: number;
  isSol: boolean;
}

/** A single holding, fully enriched with price, value and identity. */
export interface PortfolioHolding {
  mint: string;
  amount: number;
  decimals: number;
  isSol: boolean;
  name: string;
  symbol: string;
  imageUrl: string | null;
  priceUsd: number;
  valueUsd: number;
  priceChange24h: number;
  /** Share of the whole portfolio, 0–100. */
  allocationPct: number;
  /** Raw market pair (for the sparkline); null when the token has no price. */
  market: MarketPair | null;
}

/** The finished, ready-to-render portfolio for one wallet. */
export interface WalletPortfolio {
  address: string;
  totalUsd: number;
  change24hUsd: number;
  change24hPct: number;
  solAmount: number;
  solPriceUsd: number;
  /** Holdings sorted by USD value, largest first. */
  list_of_holdings: PortfolioHolding[];
  pricedCount: number;
  unpricedCount: number;
}

/** One entry from the Jupiter Ultra balances map. */
interface JupiterBalanceEntry {
  /** Raw on-chain amount, as an integer string (not yet scaled by decimals). */
  amount: string;
  /** Human amount, already scaled down by the token's decimals. */
  uiAmount: number;
}

/**
 * Recover a token's decimals from its raw and human amounts: a raw integer of
 * `r` displayed as `ui` implies `r = ui * 10**decimals`, so
 * `decimals = round(log10(r / ui))`. The endpoint omits decimals, and nothing
 * downstream needs them to be exact, so a best-effort recovery is enough.
 */
function decimalsFromAmounts(rawAmount: string, uiAmount: number): number {
  const raw = Number(rawAmount);
  if (!Number.isFinite(raw) || raw <= 0 || !Number.isFinite(uiAmount) || uiAmount <= 0) {
    return 0;
  }
  return Math.max(0, Math.round(Math.log10(raw / uiAmount)));
}

/**
 * Read every non-zero balance a wallet holds: native SOL plus all SPL and
 * Token-2022 balances. Zero balances are dropped so callers only see tokens the
 * wallet actually owns.
 *
 * Balances come from Jupiter's keyless Ultra endpoint, which returns them keyed
 * by mint (with the literal key `"SOL"` for the native balance) in a single
 * CORS-friendly request.
 */
export async function fetchWalletBalances(address: string): Promise<WalletBalance[]> {
  const response = await fetch(
    `${JUPITER_ULTRA_BASE}/balances/${encodeURIComponent(address)}`
  );
  if (!response.ok) {
    throw new Error(`Balances request failed with status ${response.status}`);
  }

  const balances = (await response.json()) as Record<string, JupiterBalanceEntry>;

  const list_of_balances: WalletBalance[] = [];
  for (const [key, entry] of Object.entries(balances)) {
    const uiAmount = Number(entry?.uiAmount ?? 0);
    if (!Number.isFinite(uiAmount) || uiAmount <= 0) continue;

    const isSol = key === "SOL";
    list_of_balances.push({
      mint: isSol ? WRAPPED_SOL_MINT : key,
      amount: uiAmount,
      decimals: isSol ? 9 : decimalsFromAmounts(entry.amount, uiAmount),
      isSol,
    });
  }

  return list_of_balances;
}

/** Fetch briefs for arbitrarily many mints (the API caps at 30 per request). */
async function fetchBriefsForAll(mints: string[]): Promise<Record<string, TokenBrief>> {
  const merged: Record<string, TokenBrief> = {};
  for (let i = 0; i < mints.length; i += 30) {
    const batch = mints.slice(i, i + 30);
    const map = await fetchTokenBriefs(batch);
    Object.assign(merged, map);
  }
  return merged;
}

/**
 * Load a wallet's complete portfolio in one call: balances, live prices, token
 * identities, per-holding USD value, portfolio total and 24h change. Holdings
 * come back sorted by value so the biggest positions render first.
 *
 * The 24h change is reconstructed from each token's trailing 24h price move:
 * a holding worth $V that is up x% is derived from a value of V / (1 + x/100)
 * a day ago, and the portfolio change is the sum across every priced holding.
 */
export async function loadWalletPortfolio(address: string): Promise<WalletPortfolio> {
  const list_of_balances = await fetchWalletBalances(address);
  const mints = list_of_balances.map((balance) => balance.mint);

  const [marketByMint, briefByMint] = await Promise.all([
    fetchMarketPairsResilient(mints),
    fetchBriefsForAll(mints),
  ]);

  const solPriceUsd = marketByMint[WRAPPED_SOL_MINT]?.priceUsd ?? 0;

  const list_of_priced = list_of_balances.map((balance) => {
    const market = marketByMint[balance.mint] ?? null;
    const brief = briefByMint[balance.mint];
    const priceUsd = market?.priceUsd ?? 0;
    const valueUsd = balance.amount * priceUsd;
    const priceChange24h = market?.priceChange.h24 ?? 0;
    return {
      mint: balance.mint,
      amount: balance.amount,
      decimals: balance.decimals,
      isSol: balance.isSol,
      name:
        (balance.isSol ? "Solana" : brief?.name?.trim() || market?.baseName?.trim()) || "",
      symbol:
        (balance.isSol ? "SOL" : brief?.symbol?.trim() || market?.baseSymbol?.trim()) || "",
      imageUrl: brief?.imageUrl ?? market?.imageUrl ?? null,
      priceUsd,
      valueUsd,
      priceChange24h,
      market,
    };
  });

  const totalUsd = list_of_priced.reduce((sum, holding) => sum + holding.valueUsd, 0);

  const totalPrevUsd = list_of_priced.reduce((sum, holding) => {
    if (holding.valueUsd <= 0 || holding.priceChange24h <= -100) return sum + holding.valueUsd;
    return sum + holding.valueUsd / (1 + holding.priceChange24h / 100);
  }, 0);
  const change24hUsd = totalUsd - totalPrevUsd;
  const change24hPct = totalPrevUsd > 0 ? (change24hUsd / totalPrevUsd) * 100 : 0;

  const list_of_holdings: PortfolioHolding[] = list_of_priced
    .map((holding) => ({
      ...holding,
      allocationPct: totalUsd > 0 ? (holding.valueUsd / totalUsd) * 100 : 0,
    }))
    .sort((a, b) => b.valueUsd - a.valueUsd);

  const solHolding = list_of_holdings.find((holding) => holding.isSol);

  return {
    address,
    totalUsd,
    change24hUsd,
    change24hPct,
    solAmount: solHolding?.amount ?? 0,
    solPriceUsd,
    list_of_holdings,
    pricedCount: list_of_holdings.filter((holding) => holding.valueUsd > 0).length,
    unpricedCount: list_of_holdings.filter((holding) => holding.valueUsd <= 0).length,
  };
}

/**
 * Format a token balance for display: big balances go compact (1.23M), normal
 * balances keep up to 4 decimals, and tiny balances keep enough precision to
 * stay meaningful without turning into a wall of zeros.
 */
export function formatTokenAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount === 0) return "0";
  const abs = Math.abs(amount);
  if (abs >= 1e9) return `${(amount / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(amount / 1e6).toFixed(2)}M`;
  if (abs >= 1) return amount.toLocaleString("en-US", { maximumFractionDigits: 4 });
  if (abs >= 0.0001) return amount.toLocaleString("en-US", { maximumFractionDigits: 6 });
  return amount.toExponential(2);
}
