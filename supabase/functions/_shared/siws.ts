import nacl from "tweetnacl";
import bs58 from "bs58";
import { verifyMessage } from "viem";
import { type ChainType } from "./chains.ts";

/**
 * Sign-In-with-wallet style message, chain-neutral so the exact same builder
 * works for both Solana (ed25519) and EVM (EIP-191 personal_sign). The server
 * reconstructs this EXACT string from its own stored nonce data and verifies
 * the signature against it, so the client cannot alter any field (wallet,
 * token, nonce, domain).
 */
export function buildSignMessage(params: {
  domain: string;
  wallet: string;
  tokenAddress: string;
  nonce: string;
  issuedAt: string; // ISO string
}): string {
  return [
    `${params.domain} wants you to verify token authority with your wallet:`,
    params.wallet,
    ``,
    `Authorize editing token info for:`,
    params.tokenAddress,
    ``,
    `This signature does NOT approve any transaction and costs nothing.`,
    ``,
    `Nonce: ${params.nonce}`,
    `Issued At: ${params.issuedAt}`,
  ].join("\n");
}

/** Verify an ed25519 signature (base58) over a UTF-8 message for a base58 pubkey. */
export function verifySignature(message: string, signatureB58: string, walletB58: string): boolean {
  try {
    const sig = bs58.decode(signatureB58);
    const pub = bs58.decode(walletB58);
    if (sig.length !== 64 || pub.length !== 32) return false;
    return nacl.sign.detached.verify(new TextEncoder().encode(message), sig, pub);
  } catch {
    return false;
  }
}

/**
 * Verify an EVM EIP-191 (`personal_sign`) signature. `signature` is 0x-hex and
 * `wallet` is the 0x address; viem recovers the signer and compares (address
 * comparison is case-insensitive internally).
 */
export async function verifyEvmSignature(
  message: string,
  signature: string,
  wallet: string
): Promise<boolean> {
  try {
    return await verifyMessage({
      address: wallet as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
  } catch {
    return false;
  }
}

/**
 * Chain-aware signature verification: dispatches to ed25519 for Solana and
 * EIP-191 recovery for EVM.
 */
export async function verifyChainSignature(
  chainType: ChainType,
  message: string,
  signature: string,
  wallet: string
): Promise<boolean> {
  if (chainType === "evm") return verifyEvmSignature(message, signature, wallet);
  return verifySignature(message, signature, wallet);
}
