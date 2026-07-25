/**
 * DUX enhanced-info lookups for arbitrary tokens.
 *
 * The public API exposes per-token profiles at
 * `GET /token-profiles/{chainId}/{tokenAddress}` (404 when a token has never
 * been enhanced). The command palette uses this to tell searchers, at a glance,
 * which of their search results already carry verified DUX info and when that
 * info was last updated.
 */

import { API_BASE } from "./config";
import { DEFAULT_CHAIN_ID } from "./chains";

/** Whether a token has DUX enhanced info, and when it was last updated. */
export interface DuxProfileStatus {
  hasProfile: boolean;
  updatedAt: string | null;
}

/** A (chain, address) token reference. */
export interface TokenRef {
  chainId: string;
  address: string;
}

/** Composite lookup key for a token, stable across chains. */
export function tokenRefKey(chainId: string, address: string): string {
  return `${chainId}:${address}`;
}

const NOT_ENHANCED: DuxProfileStatus = { hasProfile: false, updatedAt: null };

/** Look up the DUX enhanced-info status for a single token. */
export async function fetchDuxProfileStatus(
  address: string,
  chainId: string = DEFAULT_CHAIN_ID
): Promise<DuxProfileStatus> {
  try {
    const res = await fetch(`${API_BASE}/token-profiles/${chainId}/${address}`, {
      cache: "no-store",
    });
    if (!res.ok) return NOT_ENHANCED;
    const profile = await res.json();
    return { hasProfile: true, updatedAt: profile?.updatedAt ?? null };
  } catch {
    return NOT_ENHANCED;
  }
}

/**
 * Look up DUX status for many tokens at once. There is no batch endpoint for
 * arbitrary tokens, so this fans out one request per token; callers keep the
 * list small (a page of search results). Results are merged into a lookup keyed
 * by {@link tokenRefKey} so the same address on two chains stays distinct.
 */
export async function fetchDuxProfileStatuses(
  refs: TokenRef[]
): Promise<Record<string, DuxProfileStatus>> {
  const seen = new Set<string>();
  const unique = refs.filter((ref) => {
    const key = tokenRefKey(ref.chainId, ref.address);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const statusByKey: Record<string, DuxProfileStatus> = {};
  await Promise.all(
    unique.map(async (ref) => {
      statusByKey[tokenRefKey(ref.chainId, ref.address)] = await fetchDuxProfileStatus(
        ref.address,
        ref.chainId
      );
    })
  );
  return statusByKey;
}
