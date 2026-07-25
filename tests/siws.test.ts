import { describe, it, expect } from "vitest";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { privateKeyToAccount } from "viem/accounts";
import {
  buildSignMessage,
  verifySignature,
  verifyEvmSignature,
  verifyChainSignature,
} from "../supabase/functions/_shared/siws.ts";

function makeKeypair() {
  const kp = nacl.sign.keyPair();
  return {
    publicKeyB58: bs58.encode(kp.publicKey),
    sign(message: string) {
      return bs58.encode(nacl.sign.detached(new TextEncoder().encode(message), kp.secretKey));
    },
  };
}

const params = {
  domain: "dux.example",
  wallet: "",
  tokenAddress: "So11111111111111111111111111111111111111112",
  nonce: "a".repeat(64),
  issuedAt: "2026-07-19T00:00:00.000Z",
};

describe("SIWS message + signature", () => {
  it("accepts a valid signature from the right wallet", () => {
    const kp = makeKeypair();
    const msg = buildSignMessage({ ...params, wallet: kp.publicKeyB58 });
    expect(verifySignature(msg, kp.sign(msg), kp.publicKeyB58)).toBe(true);
  });

  it("rejects a signature from a different wallet", () => {
    const kp = makeKeypair();
    const other = makeKeypair();
    const msg = buildSignMessage({ ...params, wallet: kp.publicKeyB58 });
    expect(verifySignature(msg, other.sign(msg), kp.publicKeyB58)).toBe(false);
  });

  it("rejects a signature over a tampered message", () => {
    const kp = makeKeypair();
    const msg = buildSignMessage({ ...params, wallet: kp.publicKeyB58 });
    const sig = kp.sign(msg);
    const tampered = buildSignMessage({
      ...params,
      wallet: kp.publicKeyB58,
      tokenAddress: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    });
    expect(verifySignature(tampered, sig, kp.publicKeyB58)).toBe(false);
  });

  it("rejects malformed inputs without throwing", () => {
    expect(verifySignature("msg", "not-base58-!!!", "also-not-!!!")).toBe(false);
    expect(
      verifySignature("msg", bs58.encode(new Uint8Array(10)), bs58.encode(new Uint8Array(32)))
    ).toBe(false);
  });

  it("message binds domain, wallet, token and nonce", () => {
    const kp = makeKeypair();
    const msg = buildSignMessage({ ...params, wallet: kp.publicKeyB58 });
    expect(msg).toContain(params.domain);
    expect(msg).toContain(kp.publicKeyB58);
    expect(msg).toContain(params.tokenAddress);
    expect(msg).toContain(params.nonce);
  });
});

describe("EIP-191 (EVM) signature verification", () => {
  // deterministic test key (well-known anvil account #0)
  const account = privateKeyToAccount(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  );

  it("accepts a valid EIP-191 signature from the right wallet", async () => {
    const msg = buildSignMessage({ ...params, wallet: account.address });
    const sig = await account.signMessage({ message: msg });
    expect(await verifyEvmSignature(msg, sig, account.address)).toBe(true);
  });

  it("rejects a signature from a different wallet", async () => {
    const other = privateKeyToAccount(
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
    );
    const msg = buildSignMessage({ ...params, wallet: account.address });
    const sig = await other.signMessage({ message: msg });
    expect(await verifyEvmSignature(msg, sig, account.address)).toBe(false);
  });

  it("rejects a signature over a tampered message", async () => {
    const msg = buildSignMessage({ ...params, wallet: account.address });
    const sig = await account.signMessage({ message: msg });
    const tampered = buildSignMessage({
      ...params,
      wallet: account.address,
      tokenAddress: "0x4200000000000000000000000000000000000006",
    });
    expect(await verifyEvmSignature(tampered, sig, account.address)).toBe(false);
  });

  it("rejects malformed signatures without throwing", async () => {
    expect(await verifyEvmSignature("msg", "0xdeadbeef", account.address)).toBe(false);
    expect(await verifyEvmSignature("msg", "not-hex", account.address)).toBe(false);
  });

  it("dispatches by chain type via verifyChainSignature", async () => {
    const msg = buildSignMessage({ ...params, wallet: account.address });
    const sig = await account.signMessage({ message: msg });
    expect(await verifyChainSignature("evm", msg, sig, account.address)).toBe(true);

    const kp = makeKeypair();
    const solMsg = buildSignMessage({ ...params, wallet: kp.publicKeyB58 });
    expect(await verifyChainSignature("solana", solMsg, kp.sign(solMsg), kp.publicKeyB58)).toBe(true);
  });
});
