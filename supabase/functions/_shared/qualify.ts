import { chainTypeOf } from "./chains.ts";
import { qualifyWallet, type QualifyResult } from "./solana.ts";
import { qualifyWalletEvm } from "./evm.ts";

/**
 * Chain-aware on-chain qualification dispatcher. Routes to the Solana flow
 * (Metaplex / pump.fun / SPL holder) or the EVM flow (Ownable owner / ERC-20
 * holder) based on the token's chain family, returning the same
 * {@link QualifyResult} shape either way.
 */
export function qualifyWalletForChain(
  chainId: string,
  wallet: string,
  tokenAddress: string
): Promise<QualifyResult> {
  return chainTypeOf(chainId) === "evm"
    ? qualifyWalletEvm(chainId, wallet, tokenAddress)
    : qualifyWallet(wallet, tokenAddress);
}
