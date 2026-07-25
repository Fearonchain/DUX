import { createPublicClient, http, getAddress, type Address } from "viem";
import { getChain, rpcUrlForChain } from "./chains.ts";
import { holderThresholdPercent, type QualifyResult } from "./solana.ts";

/**
 * On-chain qualification for EVM (ERC-20) tokens, mirroring the Solana flow in
 * `solana.ts`. A wallet qualifies to edit a token's info when it is:
 *
 *   1. the contract's `owner()` (OpenZeppelin Ownable) → role "authority", or
 *   2. a holder of at least `HOLDER_THRESHOLD_PERCENT` of `totalSupply()`
 *      (via `balanceOf(wallet)`) → role "holder".
 *
 * Deployer/creator detection needs a block-explorer or indexer API and is
 * intentionally deferred (documented as a follow-up); `owner()` plus the holder
 * threshold cover the common cases keylessly over a public RPC.
 */

const OWNABLE_ABI = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

const ERC20_ABI = [
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

/** BigInt percentage with 4 decimals of precision (mirrors solana.ts). */
function computePercent(heldRaw: bigint, supplyRaw: bigint): number {
  if (supplyRaw <= BigInt(0)) return 0;
  const scaled = (heldRaw * BigInt(1_000_000)) / supplyRaw;
  return Number(scaled) / 10_000;
}

function clientFor(chainId: string) {
  const chain = getChain(chainId);
  if (!chain || chain.type !== "evm" || chain.evmChainId === undefined) {
    throw new Error(`not an EVM chain: ${chainId}`);
  }
  return createPublicClient({ transport: http(rpcUrlForChain(chainId)) });
}

/**
 * Checks whether `wallet` qualifies to edit token info for an ERC-20 `token`
 * on the given EVM chain.
 */
export async function qualifyWalletEvm(
  chainId: string,
  wallet: string,
  tokenAddress: string
): Promise<QualifyResult> {
  let walletAddr: Address;
  let tokenAddr: Address;
  try {
    walletAddr = getAddress(wallet);
    tokenAddr = getAddress(tokenAddress);
  } catch {
    return { qualified: false, detail: "invalid EVM address" };
  }

  const client = clientFor(chainId);

  // 1. Ownable owner() — many tokens expose it; a revert just means "not Ownable".
  try {
    const owner = (await client.readContract({
      address: tokenAddr,
      abi: OWNABLE_ABI,
      functionName: "owner",
    })) as Address;
    if (owner && getAddress(owner) === walletAddr) {
      return { qualified: true, role: "authority", detail: "wallet is the contract owner" };
    }
  } catch {
    /* token is not Ownable — fall through to the holder check */
  }

  // 2. holder >= threshold %
  const threshold = holderThresholdPercent();
  let supplyRaw: bigint;
  let heldRaw: bigint;
  try {
    [supplyRaw, heldRaw] = await Promise.all([
      client.readContract({ address: tokenAddr, abi: ERC20_ABI, functionName: "totalSupply" }) as Promise<bigint>,
      client.readContract({
        address: tokenAddr,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [walletAddr],
      }) as Promise<bigint>,
    ]);
  } catch {
    return { qualified: false, detail: "address is not a readable ERC-20 token" };
  }

  if (supplyRaw <= BigInt(0)) return { qualified: false, detail: "token has zero supply" };

  const percent = computePercent(heldRaw, supplyRaw);
  if (percent >= threshold) {
    return {
      qualified: true,
      role: "holder",
      percent,
      detail: `wallet holds ${percent.toFixed(2)}% (threshold ${threshold}%)`,
    };
  }
  return {
    qualified: false,
    percent,
    detail: `wallet holds ${percent.toFixed(4)}%, below the ${threshold}% threshold and not the contract owner`,
  };
}
