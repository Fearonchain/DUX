/**
 * Central chain registry (browser side).
 *
 * A token on Torch is identified by `(chainId, address)`. This registry is the
 * single source of truth that maps a Torch chain id (e.g. "solana", "base") to
 * everything the frontend needs: the chain family (Solana vs EVM), the numeric
 * EVM chain id, the slugs the market-data providers use (Dexscreener and
 * GeckoTerminal name the same chain differently), block-explorer URLs, and the
 * native gas symbol.
 *
 * The backend keeps a mirrored copy in `supabase/functions/_shared/chains.ts`
 * (it additionally carries RPC config), so keep the two in sync when adding a
 * chain.
 */

export type ChainType = "solana" | "evm";

export interface ChainInfo {
  /** Torch chain id used throughout the app and API (lowercase slug). */
  id: string;
  /** Human-friendly display name. */
  name: string;
  /** Chain family: drives signing, address validation and qualification. */
  type: ChainType;
  /** Numeric EVM chain id (only for `type === "evm"`). */
  evmChainId?: number;
  /** Native gas token symbol, shown as a fallback quote symbol. */
  nativeSymbol: string;
  /** Dexscreener's chain slug (used to filter `pairs[].chainId`). */
  dexscreenerSlug: string;
  /** GeckoTerminal's network slug (used in `/networks/{slug}/...`). */
  geckoterminalSlug: string;
  /** Base block-explorer URL, no trailing slash. */
  explorerBaseUrl: string;
}

/** The Solana chain id is the historical default across the whole app. */
export const DEFAULT_CHAIN_ID = "solana";

export const SUPPORTED_CHAINS: ChainInfo[] = [
  {
    id: "solana",
    name: "Solana",
    type: "solana",
    nativeSymbol: "SOL",
    dexscreenerSlug: "solana",
    geckoterminalSlug: "solana",
    explorerBaseUrl: "https://solscan.io",
  },
  {
    id: "ethereum",
    name: "Ethereum",
    type: "evm",
    evmChainId: 1,
    nativeSymbol: "ETH",
    dexscreenerSlug: "ethereum",
    geckoterminalSlug: "eth",
    explorerBaseUrl: "https://etherscan.io",
  },
  {
    id: "base",
    name: "Base",
    type: "evm",
    evmChainId: 8453,
    nativeSymbol: "ETH",
    dexscreenerSlug: "base",
    geckoterminalSlug: "base",
    explorerBaseUrl: "https://basescan.org",
  },
  {
    id: "arbitrum",
    name: "Arbitrum",
    type: "evm",
    evmChainId: 42161,
    nativeSymbol: "ETH",
    dexscreenerSlug: "arbitrum",
    geckoterminalSlug: "arbitrum",
    explorerBaseUrl: "https://arbiscan.io",
  },
  {
    id: "bsc",
    name: "BNB Chain",
    type: "evm",
    evmChainId: 56,
    nativeSymbol: "BNB",
    dexscreenerSlug: "bsc",
    geckoterminalSlug: "bsc",
    explorerBaseUrl: "https://bscscan.com",
  },
  {
    id: "polygon",
    name: "Polygon",
    type: "evm",
    evmChainId: 137,
    nativeSymbol: "POL",
    dexscreenerSlug: "polygon",
    geckoterminalSlug: "polygon_pos",
    explorerBaseUrl: "https://polygonscan.com",
  },
  {
    id: "optimism",
    name: "Optimism",
    type: "evm",
    evmChainId: 10,
    nativeSymbol: "ETH",
    dexscreenerSlug: "optimism",
    geckoterminalSlug: "optimism",
    explorerBaseUrl: "https://optimistic.etherscan.io",
  },
  {
    id: "avalanche",
    name: "Avalanche",
    type: "evm",
    evmChainId: 43114,
    nativeSymbol: "AVAX",
    dexscreenerSlug: "avalanche",
    geckoterminalSlug: "avax",
    explorerBaseUrl: "https://snowtrace.io",
  },
];

const CHAIN_BY_ID = new Map(SUPPORTED_CHAINS.map((chain) => [chain.id, chain]));
const CHAIN_BY_EVM_ID = new Map(
  SUPPORTED_CHAINS.filter((chain) => chain.evmChainId !== undefined).map((chain) => [
    chain.evmChainId as number,
    chain,
  ])
);

/** Look up a chain by its Torch id, or `undefined` when unknown. */
export function getChain(chainId: string | undefined | null): ChainInfo | undefined {
  if (!chainId) return undefined;
  return CHAIN_BY_ID.get(chainId.toLowerCase());
}

/** Look up an EVM chain by its numeric chain id (e.g. 8453 → base). */
export function getChainByEvmId(evmChainId: number): ChainInfo | undefined {
  return CHAIN_BY_EVM_ID.get(evmChainId);
}

/** Whether the given id maps to a supported chain. */
export function isSupportedChain(chainId: string | undefined | null): boolean {
  return getChain(chainId) !== undefined;
}

/** The chain family for a chain id, defaulting to Solana for unknown ids. */
export function chainTypeOf(chainId: string | undefined | null): ChainType {
  return getChain(chainId)?.type ?? "solana";
}

/** True when a string looks like a valid 0x-prefixed 20-byte EVM address. */
export function isValidEvmAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address.trim());
}

/** True when a string looks like a valid base58 Solana address. */
export function isValidSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address.trim());
}

/** Validate an address against the address format expected by a given chain. */
export function isValidAddressForChain(chainId: string, address: string): boolean {
  return chainTypeOf(chainId) === "evm"
    ? isValidEvmAddress(address)
    : isValidSolanaAddress(address);
}

/** Block-explorer URL for a wallet/account on a given chain. */
export function explorerAccountUrl(chainId: string, address: string): string {
  const chain = getChain(chainId) ?? getChain(DEFAULT_CHAIN_ID)!;
  const segment = chain.type === "solana" ? "account" : "address";
  return `${chain.explorerBaseUrl}/${segment}/${address}`;
}

/** Block-explorer URL for a token/mint on a given chain. */
export function explorerTokenUrl(chainId: string, address: string): string {
  const chain = getChain(chainId) ?? getChain(DEFAULT_CHAIN_ID)!;
  return `${chain.explorerBaseUrl}/token/${address}`;
}

/** Dexscreener pair page URL for a chain + pair address. */
export function dexscreenerPairUrl(chainId: string, pairAddress: string): string {
  const chain = getChain(chainId) ?? getChain(DEFAULT_CHAIN_ID)!;
  return `https://dexscreener.com/${chain.dexscreenerSlug}/${pairAddress}`;
}
