import { getDb } from "../_shared/db.ts";
import { buildSignMessage, verifyChainSignature } from "../_shared/siws.ts";
import { qualifyWalletForChain } from "../_shared/qualify.ts";
import { issueEditToken, EDIT_TOKEN_TTL_SECONDS } from "../_shared/jwt.ts";
import { isValidAddressForChain, normalizeAddress } from "../_shared/validation.ts";
import { DEFAULT_CHAIN_ID, chainTypeOf, getChain } from "../_shared/chains.ts";
import { corsPreflight, json, rateLimit, clientIp, normalizedPath } from "../_shared/http.ts";
import { z } from "zod";

const NONCE_TTL_MS = 5 * 60 * 1000;

// chainId is optional for backward compatibility (defaults to Solana); the
// wallet/token address formats are validated per-chain after parsing.
const nonceBody = z.object({
  chainId: z.string().max(32).optional(),
  wallet: z.string().min(1).max(128),
  tokenAddress: z.string().min(1).max(128),
});

// Solana signatures are base58 (~88 chars); EVM signatures are 0x + 130 hex
// (132 chars), so widen the accepted signature length range.
const verifyBody = z.object({
  chainId: z.string().max(32).optional(),
  wallet: z.string().min(1).max(128),
  tokenAddress: z.string().min(1).max(128),
  nonce: z.string().min(32).max(128),
  signature: z.string().min(64).max(200),
});

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function handleNonce(req: Request): Promise<Response> {
  if (!rateLimit(`nonce:${clientIp(req)}`, 20, 60_000)) return json({ error: "rate limited" }, 429);

  let body;
  try {
    body = nonceBody.parse(await req.json());
  } catch {
    return json({ error: "invalid wallet or tokenAddress" }, 400);
  }

  const chainId = body.chainId ?? DEFAULT_CHAIN_ID;
  if (!getChain(chainId)) return json({ error: "unsupported chainId" }, 400);
  if (!isValidAddressForChain(chainId, body.wallet) || !isValidAddressForChain(chainId, body.tokenAddress)) {
    return json({ error: "invalid wallet or tokenAddress for chain" }, 400);
  }

  const wallet = normalizeAddress(chainId, body.wallet);
  const tokenAddress = normalizeAddress(chainId, body.tokenAddress);

  const nonce = randomHex(32);
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + NONCE_TTL_MS);

  const sql = getDb();
  // opportunistic cleanup of expired nonces
  await sql`DELETE FROM auth_nonces WHERE expires_at < now()`;
  await sql`
    INSERT INTO auth_nonces (nonce, wallet, token_address, chain_id, expires_at)
    VALUES (${nonce}, ${wallet}, ${tokenAddress}, ${chainId}, ${expiresAt.toISOString()})
  `;

  const domain = new URL(req.url).host;
  const message = buildSignMessage({
    domain,
    wallet,
    tokenAddress,
    nonce,
    issuedAt: issuedAt.toISOString(),
  });

  return json({ nonce, issuedAt: issuedAt.toISOString(), message });
}

async function handleVerify(req: Request): Promise<Response> {
  if (!rateLimit(`verify:${clientIp(req)}`, 10, 60_000)) return json({ error: "rate limited" }, 429);

  let body;
  try {
    body = verifyBody.parse(await req.json());
  } catch {
    return json({ error: "invalid request body" }, 400);
  }

  const sql = getDb();

  // 1. nonce must exist, be unused and unexpired. The chain the nonce was
  //    bound to at issuance is authoritative (tamper-proof), so we read it back
  //    rather than trusting the request body.
  const rows = await sql`
    SELECT id, nonce, wallet, token_address, chain_id, used, expires_at
    FROM auth_nonces WHERE nonce = ${body.nonce} AND used = false LIMIT 1
  `;
  const nonceRow = rows[0];
  const chainId: string = nonceRow?.chain_id ?? DEFAULT_CHAIN_ID;
  const wallet = nonceRow ? normalizeAddress(chainId, body.wallet) : body.wallet;
  const tokenAddress = nonceRow ? normalizeAddress(chainId, body.tokenAddress) : body.tokenAddress;
  if (!nonceRow || nonceRow.wallet !== wallet || nonceRow.token_address !== tokenAddress) {
    return json({ error: "unknown or mismatched nonce" }, 401);
  }
  const expiresAt = new Date(nonceRow.expires_at);
  if (expiresAt.getTime() < Date.now()) {
    return json({ error: "nonce expired, request a new one" }, 401);
  }

  // 2. mark used FIRST (single-use, race-safe)
  const updated = await sql`
    UPDATE auth_nonces SET used = true
    WHERE id = ${nonceRow.id} AND used = false
    RETURNING id
  `;
  if (updated.length === 0) return json({ error: "nonce already used" }, 401);

  // 3. reconstruct exact message server-side, verify signature (chain-aware:
  //    ed25519 for Solana, EIP-191 recovery for EVM)
  const issuedAt = new Date(expiresAt.getTime() - NONCE_TTL_MS);
  const domain = new URL(req.url).host;
  const message = buildSignMessage({
    domain,
    wallet: nonceRow.wallet,
    tokenAddress: nonceRow.token_address,
    nonce: nonceRow.nonce,
    issuedAt: issuedAt.toISOString(),
  });
  const validSignature = await verifyChainSignature(
    chainTypeOf(chainId),
    message,
    body.signature,
    wallet
  );
  if (!validSignature) {
    return json({ error: "invalid signature" }, 401);
  }

  // 4. on-chain qualification (dispatched by chain family)
  let result;
  try {
    result = await qualifyWalletForChain(chainId, wallet, tokenAddress);
  } catch {
    return json({ error: "on-chain verification failed (RPC error), please retry" }, 502);
  }
  if (!result.qualified || !result.role) {
    return json({ error: "not authorized for this token", detail: result.detail }, 403);
  }

  const editToken = await issueEditToken({
    wallet,
    chainId,
    tokenAddress,
    role: result.role,
  });

  return json({
    editToken,
    role: result.role,
    detail: result.detail,
    expiresInSeconds: EDIT_TOKEN_TTL_SECONDS,
  });
}

export async function handler(req: Request): Promise<Response> {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const path = normalizedPath(req);
  if (req.method === "POST" && path === "/auth/nonce") return handleNonce(req);
  if (req.method === "POST" && path === "/auth/verify") return handleVerify(req);
  return json({ error: "not found" }, 404);
}
