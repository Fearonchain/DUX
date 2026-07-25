/**
 * Base URL of the backend (Supabase Edge Functions).
 *
 * In production this is:
 *   https://<project-ref>.supabase.co/functions/v1
 *
 * Set it via the VITE_API_BASE env var (see .env.example).
 * Falls back to the local dev runner.
 */
export const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:8787";

/** RPC used by the wallet adapter in the browser (wallet plumbing only). */
export const BROWSER_RPC: string =
  (import.meta.env.VITE_SOLANA_RPC_URL as string | undefined) ||
  "https://api.mainnet-beta.solana.com";

/**
 * Reown (WalletConnect) project id that powers the unified EVM + Solana wallet
 * modal. Get one free at https://dashboard.reown.com. Empty until configured,
 * in which case the wallet modal falls back to injected-only connectors.
 */
export const REOWN_PROJECT_ID: string =
  (import.meta.env.VITE_REOWN_PROJECT_ID as string | undefined) || "";

/**
 * The project's own token contract (the $TORCH mint).
 *
 * Empty until the token is live. Set this to the mint address to light up the
 * copyable CA chip in the sidebar, footer and landing hero across the whole site.
 */
export const TOKEN_CONTRACT_ADDRESS: string = "";
