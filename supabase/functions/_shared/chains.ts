import { env } from "./env.ts";

/**
 * Central chain registry (backend / Deno side).
 *
 * Mirrors the browser registry in `src/lib/chains.ts` but additionally carries
 * the RPC configuration each edge function needs for on-chain qualification.
 * Every EVM chain has a keyless public default RPC and an optional env override
 * (e.g. `BASE_RPC_URL`) so operators can plug in a keyed provider later.
 *
 * Keep this in sync with the frontend registry when adding a chain.
 */

export type ChainType = "solana" | "evm";

export interface ChainInfo {
  /** Torch chain id used throughout the app and API (lowercase slug). */
  id: string;
  /** Human-friendly display name. */
  name: string;
  /** Chain family: drives signing verification and qualification. */
  type: ChainType;
  /** Numeric EVM chain id (only for `type === "evm"`). */
  evmChainId?: number;
  /** Native gas token symbol. */
  nativeSymbol: string;
  /** Dexscreener's chain slug. */
  dexscreenerSlug: string;
  /** GeckoTerminal's network slug. */
  geckoterminalSlug: string;
  /** Env var name that overrides the RPC endpoint for this chain. */
  rpcEnvKey: string;
  /** Keyless public RPC endpoint used when the env override is unset. */
  defaultRpc: string;
}

export const DEFAULT_CHAIN_ID = "solana";

export const SUPPORTED_CHAINS: ChainInfo[] = [
  {
    id: "solana",
    name: "Solana",
    type: "solana",
    nativeSymbol: "SOL",
    dexscreenerSlug: "solana",
    geckoterminalSlug: "solana",
    rpcEnvKey: "SOLANA_RPC_URL",
    defaultRpc: "https://api.mainnet-beta.solana.com",
  },
  {
    id: "ethereum",
    name: "Ethereum",
    type: "evm",
    evmChainId: 1,
    nativeSymbol: "ETH",
    dexscreenerSlug: "ethereum",
    geckoterminalSlug: "eth",
    rpcEnvKey: "ETHEREUM_RPC_URL",
    defaultRpc: "https://ethereum-rpc.publicnode.com",
  },
  {
    id: "base",
    name: "Base",
    type: "evm",
    evmChainId: 8453,
    nativeSymbol: "ETH",
    dexscreenerSlug: "base",
    geckoterminalSlug: "base",
    rpcEnvKey: "BASE_RPC_URL",
    defaultRpc: "https://base-rpc.publicnode.com",
  },
  {
    id: "arbitrum",
    name: "Arbitrum",
    type: "evm",
    evmChainId: 42161,
    nativeSymbol: "ETH",
    dexscreenerSlug: "arbitrum",
    geckoterminalSlug: "arbitrum",
    rpcEnvKey: "ARBITRUM_RPC_URL",
    defaultRpc: "https://arbitrum-one-rpc.publicnode.com",
  },
  {
    id: "bsc",
    name: "BNB Chain",
    type: "evm",
    evmChainId: 56,
    nativeSymbol: "BNB",
    dexscreenerSlug: "bsc",
    geckoterminalSlug: "bsc",
    rpcEnvKey: "BSC_RPC_URL",
    defaultRpc: "https://bsc-rpc.publicnode.com",
  },
  {
    id: "polygon",
    name: "Polygon",
    type: "evm",
    evmChainId: 137,
    nativeSymbol: "POL",
    dexscreenerSlug: "polygon",
    geckoterminalSlug: "polygon_pos",
    rpcEnvKey: "POLYGON_RPC_URL",
    defaultRpc: "https://polygon-bor-rpc.publicnode.com",
  },
  {
    id: "optimism",
    name: "Optimism",
    type: "evm",
    evmChainId: 10,
    nativeSymbol: "ETH",
    dexscreenerSlug: "optimism",
    geckoterminalSlug: "optimism",
    rpcEnvKey: "OPTIMISM_RPC_URL",
    defaultRpc: "https://optimism-rpc.publicnode.com",
  },
  {
    id: "avalanche",
    name: "Avalanche",
    type: "evm",
    evmChainId: 43114,
    nativeSymbol: "AVAX",
    dexscreenerSlug: "avalanche",
    geckoterminalSlug: "avax",
    rpcEnvKey: "AVALANCHE_RPC_URL",
    defaultRpc: "https://avalanche-c-chain-rpc.publicnode.com",
  },
];

const CHAIN_BY_ID = new Map(SUPPORTED_CHAINS.map((chain) => [chain.id, chain]));

/** Look up a chain by its Torch id, or `undefined` when unknown. */
export function getChain(chainId: string | undefined | null): ChainInfo | undefined {
  if (!chainId) return undefined;
  return CHAIN_BY_ID.get(chainId.toLowerCase());
}

/** Whether the given id maps to a supported chain. */
export function isSupportedChain(chainId: string | undefined | null): boolean {
  return getChain(chainId) !== undefined;
}

/** The chain family for a chain id, defaulting to Solana for unknown ids. */
export function chainTypeOf(chainId: string | undefined | null): ChainType {
  return getChain(chainId)?.type ?? "solana";
}

/** Resolve the RPC endpoint for a chain: env override first, public default otherwise. */
export function rpcUrlForChain(chainId: string): string {
  const chain = getChain(chainId);
  if (!chain) throw new Error(`unknown chain: ${chainId}`);
  return env(chain.rpcEnvKey) || chain.defaultRpc;
}

/** True when a string looks like a valid 0x-prefixed 20-byte EVM address. */
export function isValidEvmAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address.trim());
}
