/**
 * DUX enhanced-info lookups for arbitrary tokens.
 *
 * The public API exposes per-token profiles at
 * `GET /token-profiles/solana/{tokenAddress}` (404 when a token has never been
 * enhanced). The command palette uses this to tell searchers, at a glance,
 * which of their search results already carry verified DUX info and when that
 * info was last updated.
 */

import { API_BASE } from "./config";

/** Whether a token has DUX enhanced info, and when it was last updated. */
export interface DuxProfileStatus {
  hasProfile: boolean;
  updatedAt: string | null;
}

const NOT_ENHANCED: DuxProfileStatus = { hasProfile: false, updatedAt: null };

/** Look up the DUX enhanced-info status for a single token address. */
export async function fetchDuxProfileStatus(address: string): Promise<DuxProfileStatus> {
  try {
    const res = await fetch(`${API_BASE}/token-profiles/solana/${address}`, { cache: "no-store" });
    if (!res.ok) return NOT_ENHANCED;
    const profile = await res.json();
    return { hasProfile: true, updatedAt: profile?.updatedAt ?? null };
  } catch {
    return NOT_ENHANCED;
  }
}

/**
 * Look up DUX status for many tokens at once. There is no batch endpoint for
 * arbitrary tokens, so this fans out one request per address; callers keep the
 * address list small (a page of search results) and results are merged into a
 * lookup keyed by address.
 */
export async function fetchDuxProfileStatuses(
  addresses: string[]
): Promise<Record<string, DuxProfileStatus>> {
  const unique = [...new Set(addresses)];
  const statusByAddress: Record<string, DuxProfileStatus> = {};
  await Promise.all(
    unique.map(async (address) => {
      statusByAddress[address] = await fetchDuxProfileStatus(address);
    })
  );
  return statusByAddress;
}
