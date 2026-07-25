import { SignJWT, jwtVerify } from "jose";
import { env } from "./env.ts";
import type { QualifyRole } from "./solana.ts";
import { DEFAULT_CHAIN_ID } from "./chains.ts";

const TOKEN_TTL_SECONDS = 30 * 60;

function secretKey(): Uint8Array {
  const secret = env("AUTH_SECRET");
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be set (>= 32 chars)");
  return new TextEncoder().encode(secret);
}

export interface EditGrant {
  wallet: string;
  chainId: string;
  tokenAddress: string;
  role: QualifyRole;
}

/** Issue a short-lived edit token scoped to ONE token on ONE chain. */
export async function issueEditToken(grant: EditGrant): Promise<string> {
  return new SignJWT({
    wallet: grant.wallet,
    chainId: grant.chainId,
    token: grant.tokenAddress,
    role: grant.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("dux")
    .setAudience("dux:edit")
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(secretKey());
}

/** Verify Bearer token; returns the grant or null. */
export async function verifyEditToken(bearer: string | null): Promise<EditGrant | null> {
  if (!bearer) return null;
  const token = bearer.startsWith("Bearer ") ? bearer.slice(7) : bearer;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: "dux",
      audience: "dux:edit",
    });
    if (
      typeof payload.wallet !== "string" ||
      typeof payload.token !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }
    return {
      wallet: payload.wallet,
      // Tokens issued before multi-chain support have no chainId → Solana.
      chainId: typeof payload.chainId === "string" ? payload.chainId : DEFAULT_CHAIN_ID,
      tokenAddress: payload.token,
      role: payload.role as EditGrant["role"],
    };
  } catch {
    return null;
  }
}

export const EDIT_TOKEN_TTL_SECONDS = TOKEN_TTL_SECONDS;
