import { describe, it, expect } from "vitest";
import {
  isValidSolanaAddress,
  isValidAddressForChain,
  normalizeAddress,
  linkSchema,
  profileUpdateSchema,
} from "../supabase/functions/_shared/validation.ts";
import { isValidEvmAddress } from "../supabase/functions/_shared/chains.ts";
import {
  computePercent,
  parseUpdateAuthority,
  parsePumpFunCreator,
} from "../supabase/functions/_shared/solana.ts";
import { PublicKey } from "@solana/web3.js";

describe("solana address validation", () => {
  it("accepts real addresses", () => {
    expect(isValidSolanaAddress("So11111111111111111111111111111111111111112")).toBe(true);
    expect(isValidSolanaAddress("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")).toBe(true);
  });
  it("rejects garbage", () => {
    expect(isValidSolanaAddress("")).toBe(false);
    expect(isValidSolanaAddress("hello")).toBe(false);
    expect(isValidSolanaAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe(false);
  });
});

describe("evm address validation", () => {
  it("accepts 0x-prefixed 20-byte addresses", () => {
    expect(isValidEvmAddress("0x4200000000000000000000000000000000000006")).toBe(true);
    expect(isValidEvmAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")).toBe(true);
  });
  it("rejects non-evm strings", () => {
    expect(isValidEvmAddress("")).toBe(false);
    expect(isValidEvmAddress("0x1234")).toBe(false);
    expect(isValidEvmAddress("So11111111111111111111111111111111111111112")).toBe(false);
  });
});

describe("chain-aware address validation", () => {
  const sol = "So11111111111111111111111111111111111111112";
  const evm = "0x4200000000000000000000000000000000000006";
  it("validates against the chain family", () => {
    expect(isValidAddressForChain("solana", sol)).toBe(true);
    expect(isValidAddressForChain("solana", evm)).toBe(false);
    expect(isValidAddressForChain("base", evm)).toBe(true);
    expect(isValidAddressForChain("ethereum", sol)).toBe(false);
  });
  it("normalizes EVM addresses to lowercase and leaves Solana untouched", () => {
    expect(normalizeAddress("base", "0xABCDef0000000000000000000000000000000006")).toBe(
      "0xabcdef0000000000000000000000000000000006"
    );
    expect(normalizeAddress("solana", sol)).toBe(sol);
  });
});

describe("link validation", () => {
  it("accepts https links", () => {
    expect(linkSchema.safeParse({ type: "website", url: "https://example.com" }).success).toBe(true);
  });
  it("rejects dangerous or private urls", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,x",
      "http://example.com",
      "https://user:pass@example.com",
      "https://localhost/x",
      "https://127.0.0.1/x",
      "https://foo.internal/x",
      "https://[::1]/x",
      "not a url",
    ]) {
      expect(linkSchema.safeParse({ url }).success, url).toBe(false);
    }
  });
  it("caps links at 10 and description at 600", () => {
    const links = Array.from({ length: 11 }, () => ({ url: "https://example.com" }));
    expect(profileUpdateSchema.safeParse({ links }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ description: "x".repeat(601) }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ description: "ok", links: links.slice(0, 10) }).success).toBe(true);
  });
});

describe("holder percentage math", () => {
  it("computes exact percentages with BigInt", () => {
    expect(computePercent(BigInt(3), BigInt(100))).toBeCloseTo(3);
    expect(computePercent(BigInt(29_999), BigInt(1_000_000))).toBeCloseTo(2.9999);
    expect(computePercent(BigInt(30_000), BigInt(1_000_000))).toBeCloseTo(3.0);
    expect(computePercent(BigInt(5), BigInt(0))).toBe(0);
  });
  it("handles huge supplies without precision loss", () => {
    const supply = BigInt("1000000000000000000");
    const held = supply / BigInt(33);
    expect(computePercent(held, supply)).toBeGreaterThan(3.03);
    expect(computePercent(held, supply)).toBeLessThan(3.031);
  });
});

describe("account parsing", () => {
  it("parses update authority from metadata layout", () => {
    const authority = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
    const mint = new PublicKey("So11111111111111111111111111111111111111112");
    const buf = new Uint8Array(75);
    buf[0] = 4;
    buf.set(authority.toBytes(), 1);
    buf.set(mint.toBytes(), 33);
    expect(parseUpdateAuthority(buf)).toBe(authority.toBase58());
  });
  it("returns null for short buffers", () => {
    expect(parseUpdateAuthority(new Uint8Array(10))).toBeNull();
  });
  it("parses pump.fun creator when present", () => {
    const creator = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
    const buf = new Uint8Array(81);
    buf[48] = 1;
    buf.set(creator.toBytes(), 49);
    expect(parsePumpFunCreator(buf)).toBe(creator.toBase58());
  });
  it("returns null for legacy curves / zero creator", () => {
    expect(parsePumpFunCreator(new Uint8Array(49))).toBeNull();
    expect(parsePumpFunCreator(new Uint8Array(81))).toBeNull();
  });
});
