import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import { chainTypeOf, isValidEvmAddress } from "./chains.ts";

/** Strict base58 Solana address check (throws-safe). */
export function isValidSolanaAddress(addr: string): boolean {
  if (typeof addr !== "string" || addr.length < 32 || addr.length > 44) return false;
  try {
    new PublicKey(addr);
    return true;
  } catch {
    return false;
  }
}

export const solanaAddressSchema = z.string().refine(isValidSolanaAddress, "invalid Solana address");

/** Validate an address against the format expected by a given chain. */
export function isValidAddressForChain(chainId: string, addr: string): boolean {
  return chainTypeOf(chainId) === "evm" ? isValidEvmAddress(addr) : isValidSolanaAddress(addr);
}

/**
 * Normalize an address for stable storage/compare. EVM addresses are
 * case-insensitive, so lowercase them; Solana base58 is case-sensitive and
 * kept verbatim.
 */
export function normalizeAddress(chainId: string, addr: string): string {
  return chainTypeOf(chainId) === "evm" ? addr.trim().toLowerCase() : addr.trim();
}

const ALLOWED_LINK_TYPES = ["website", "twitter"] as const;

/**
 * Link validation:
 * - https only (blocks javascript:, data:, http:)
 * - no credentials in URL, no localhost/private hosts
 * - max lengths to keep API responses sane
 */
export const linkSchema = z.object({
  type: z.enum(ALLOWED_LINK_TYPES),
  label: z.string().trim().min(1).max(32).optional(),
  url: z
    .string()
    .trim()
    .max(512)
    .refine((raw) => {
      let u: URL;
      try {
        u = new URL(raw);
      } catch {
        return false;
      }
      if (u.protocol !== "https:") return false;
      if (u.username || u.password) return false;
      const host = u.hostname.toLowerCase();
      if (
        host === "localhost" ||
        host.endsWith(".local") ||
        host.endsWith(".internal") ||
        /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
        host.startsWith("[")
      ) {
        return false;
      }
      return true;
    }, "url must be a public https:// URL"),
});

export const profileUpdateSchema = z.object({
  description: z.string().trim().max(600).optional().nullable(),
  /** at most one website link and one X (Twitter) link */
  links: z
    .array(linkSchema)
    .max(2)
    .optional()
    .refine(
      (links) => {
        if (!links) return true;
        const types = links.map((l) => l.type);
        if (new Set(types).size !== types.length) return false;
        for (const l of links) {
          if (l.type === "twitter") {
            const host = new URL(l.url).hostname.toLowerCase().replace(/^www\./, "");
            if (host !== "x.com" && host !== "twitter.com") return false;
          }
        }
        return true;
      },
      { message: "only one website link and one x.com link are allowed" }
    ),
});

export type LinkInput = z.infer<typeof linkSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

/** Upload limits (bytes, before re-encoding). */
export const MAX_BANNER_UPLOAD = 5 * 1024 * 1024;
/** Pure-JS pipeline (jpeg-js + pngjs) decodes png/jpeg, webp/gif not supported here. */
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg"];
