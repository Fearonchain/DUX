import { describe, it, expect, afterEach, vi } from "vitest";
import { qualifyWalletEvm } from "../supabase/functions/_shared/evm.ts";

/**
 * qualifyWalletEvm talks to an EVM RPC via viem's http transport (JSON-RPC
 * eth_call). We stub global fetch to return canned ABI-encoded responses so the
 * qualification logic can be exercised without a live node.
 */

const WALLET = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const TOKEN = "0x4200000000000000000000000000000000000006";

/** ABI-encode an address into a 32-byte word (left-padded). */
function encodeAddress(addr: string): string {
  return "0x" + "0".repeat(24) + addr.toLowerCase().replace(/^0x/, "");
}

/** ABI-encode a uint256 into a 32-byte word. */
function encodeUint(value: bigint): string {
  return "0x" + value.toString(16).padStart(64, "0");
}

function mockRpc(handler: (method: string, data: string) => string | null) {
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    const call = body.params?.[0] ?? {};
    // eth_call data selector is the first 4 bytes of the calldata
    const result = handler(body.method, call.data ?? "");
    if (result === null) {
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, error: { code: 3, message: "revert" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

// Function selectors (first 4 bytes of keccak256 of the signature).
const SEL_OWNER = "0x8da5cb5b";
const SEL_TOTAL_SUPPLY = "0x18160ddd";
const SEL_BALANCE_OF = "0x70a08231";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("qualifyWalletEvm", () => {
  it("qualifies the contract owner as authority", async () => {
    mockRpc((_method, data) => {
      if (data.startsWith(SEL_OWNER)) return encodeAddress(WALLET);
      return null;
    });
    const res = await qualifyWalletEvm("base", WALLET, TOKEN);
    expect(res.qualified).toBe(true);
    expect(res.role).toBe("authority");
  });

  it("qualifies a holder above the threshold", async () => {
    mockRpc((_method, data) => {
      if (data.startsWith(SEL_OWNER)) return null; // not Ownable
      if (data.startsWith(SEL_TOTAL_SUPPLY)) return encodeUint(BigInt(1000));
      if (data.startsWith(SEL_BALANCE_OF)) return encodeUint(BigInt(50)); // 5% >= 3%
      return null;
    });
    const res = await qualifyWalletEvm("base", WALLET, TOKEN);
    expect(res.qualified).toBe(true);
    expect(res.role).toBe("holder");
    expect(res.percent).toBeCloseTo(5);
  });

  it("does not qualify a small holder that is not the owner", async () => {
    mockRpc((_method, data) => {
      if (data.startsWith(SEL_OWNER)) return encodeAddress("0x1111111111111111111111111111111111111111");
      if (data.startsWith(SEL_TOTAL_SUPPLY)) return encodeUint(BigInt(1000));
      if (data.startsWith(SEL_BALANCE_OF)) return encodeUint(BigInt(1)); // 0.1% < 3%
      return null;
    });
    const res = await qualifyWalletEvm("base", WALLET, TOKEN);
    expect(res.qualified).toBe(false);
    expect(res.percent).toBeCloseTo(0.1);
  });

  it("rejects invalid EVM addresses without an RPC call", async () => {
    const res = await qualifyWalletEvm("base", "not-an-address", TOKEN);
    expect(res.qualified).toBe(false);
    expect(res.detail).toContain("invalid");
  });
});
