import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { WagmiProvider, useSignMessage } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createAppKit,
  useAppKit,
  useAppKitAccount,
  useAppKitNetwork,
  useAppKitProvider,
  useDisconnect,
  useWalletInfo,
} from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { SolanaAdapter } from "@reown/appkit-adapter-solana";
import {
  solana,
  mainnet,
  base,
  arbitrum,
  bsc,
  polygon,
  optimism,
  avalanche,
  type AppKitNetwork,
} from "@reown/appkit/networks";
import bs58 from "bs58";
import { REOWN_PROJECT_ID } from "../lib/config";
import {
  DEFAULT_CHAIN_ID,
  chainTypeOf,
  explorerAccountUrl,
  getChain,
  getChainByEvmId,
  type ChainType,
} from "../lib/chains";

/**
 * Wallet connectivity for Torch, unified across Solana and every major EVM
 * chain via Reown AppKit. AppKit renders one modal that discovers Solana Wallet
 * Standard wallets (Phantom, Solflare, Backpack…) and EVM wallets (MetaMask,
 * Coinbase, WalletConnect…) alike, so we no longer hand-roll wallet discovery.
 *
 * Torch never builds, signs or sends transactions — it only reads balances and
 * asks the wallet to sign a plain message to prove control of a token. The
 * exported {@link useWallet} facade keeps the same shape the rest of the app
 * already consumes, plus `chainId` / `chainType` and a chain-aware, wire-ready
 * `signMessage(message: string) => Promise<string>` (base58 for Solana,
 * `0x`-hex EIP-191 for EVM).
 */

/* --- AppKit singletons (created once at module load) ---------------------- */

const APPKIT_NETWORKS = [
  solana,
  mainnet,
  base,
  arbitrum,
  bsc,
  polygon,
  optimism,
  avalanche,
] as [AppKitNetwork, ...AppKitNetwork[]];

const queryClient = new QueryClient();

const wagmiAdapter = new WagmiAdapter({
  networks: APPKIT_NETWORKS,
  projectId: REOWN_PROJECT_ID,
});

const solanaAdapter = new SolanaAdapter();

const siteUrl = typeof window !== "undefined" ? window.location.origin : "https://torch.app";

// createAppKit throws when the project id is missing; guard so a misconfigured
// deploy degrades to "connect does nothing" instead of a blank-screen crash.
try {
  createAppKit({
    adapters: [wagmiAdapter, solanaAdapter],
    networks: APPKIT_NETWORKS,
    projectId: REOWN_PROJECT_ID,
    metadata: {
      name: "Torch",
      description: "Free, open-source enhanced token info across Solana and EVM chains.",
      url: siteUrl,
      icons: [`${siteUrl}/favicon.svg`],
    },
    features: {
      analytics: false,
      email: false,
      socials: false,
    },
  });
} catch (error) {
  // eslint-disable-next-line no-console
  console.error(
    "Reown AppKit failed to initialize — set VITE_REOWN_PROJECT_ID to enable wallets.",
    error
  );
}

/** The signMessage surface exposed by the AppKit Solana provider. */
interface SolanaSignerProvider {
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
}

/**
 * Resolve AppKit's active network into a Torch chain id slug. EVM networks are
 * matched by their numeric chain id; the Solana namespace maps straight to
 * "solana"; anything unknown falls back to the default chain.
 */
function activeChainSlug(caipNetwork: { id?: string | number; chainNamespace?: string } | undefined): string {
  if (!caipNetwork) return DEFAULT_CHAIN_ID;
  if (caipNetwork.chainNamespace === "solana") return "solana";
  if (caipNetwork.chainNamespace === "eip155") {
    const evmId = typeof caipNetwork.id === "number" ? caipNetwork.id : Number(caipNetwork.id);
    return getChainByEvmId(evmId)?.id ?? DEFAULT_CHAIN_ID;
  }
  return DEFAULT_CHAIN_ID;
}

/* --- Context -------------------------------------------------------------- */

interface WalletState {
  address: string | null;
  /** Torch chain id of the wallet's active network (e.g. "solana", "base"). */
  chainId: string;
  /** Chain family of the active network. */
  chainType: ChainType;
  selectedWallet: string | null;
  selectedWalletIcon: string | null;
  connected: boolean;
  connecting: boolean;
  openPicker: () => void;
  disconnect: () => Promise<void>;
  /**
   * Sign a plain-text message and return a wire-ready signature: base58 for
   * Solana, `0x`-prefixed hex (EIP-191 personal_sign) for EVM.
   */
  signMessage: (message: string) => Promise<string>;
}

const WalletCtx = createContext<WalletState | null>(null);

export function useWallet(): WalletState {
  const ctx = useContext(WalletCtx);
  if (!ctx) throw new Error("useWallet must be used inside WalletProviders");
  return ctx;
}

/** Bridges AppKit + wagmi hooks into the Torch-shaped {@link useWallet} facade. */
function WalletFacade({ children }: { children: ReactNode }) {
  const { address, isConnected, status } = useAppKitAccount();
  const { caipNetwork } = useAppKitNetwork();
  const { open } = useAppKit();
  const { disconnect: appkitDisconnect } = useDisconnect();
  const { walletInfo } = useWalletInfo();
  const { walletProvider: solanaProvider } = useAppKitProvider<SolanaSignerProvider>("solana");
  const { signMessageAsync } = useSignMessage();

  const chainId = activeChainSlug(caipNetwork as { id?: string | number; chainNamespace?: string });
  const chainType = chainTypeOf(chainId);

  const signMessage = useCallback(
    async (message: string): Promise<string> => {
      if (chainType === "evm") {
        // wagmi returns an 0x-hex EIP-191 signature.
        return await signMessageAsync({ message });
      }
      if (!solanaProvider) throw new Error("Solana wallet not connected");
      const signature = await solanaProvider.signMessage(new TextEncoder().encode(message));
      return bs58.encode(signature);
    },
    [chainType, signMessageAsync, solanaProvider]
  );

  const disconnect = useCallback(async () => {
    await appkitDisconnect();
  }, [appkitDisconnect]);

  const openPicker = useCallback(() => {
    void open();
  }, [open]);

  const value = useMemo<WalletState>(
    () => ({
      address: address ?? null,
      chainId,
      chainType,
      selectedWallet: walletInfo?.name ?? null,
      selectedWalletIcon: (walletInfo?.icon as string | undefined) ?? null,
      connected: Boolean(isConnected && address),
      connecting: status === "connecting" || status === "reconnecting",
      openPicker,
      disconnect,
      signMessage,
    }),
    [address, chainId, chainType, walletInfo, isConnected, status, openPicker, disconnect, signMessage]
  );

  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>;
}

export default function WalletProviders({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <WalletFacade>{children}</WalletFacade>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

/* --- Header connect button ------------------------------------------------ */

/** Connect button that becomes a profile dropdown once a wallet is linked. */
export function WalletButton() {
  const {
    address,
    chainId,
    connected,
    connecting,
    selectedWallet,
    selectedWalletIcon,
    openPicker,
    disconnect,
  } = useWallet();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close the dropdown on an outside click or Escape press.
  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  // Reset the "Copied" affordance shortly after it shows.
  useEffect(() => {
    if (!justCopied) return;
    const timer = window.setTimeout(() => setJustCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [justCopied]);

  if (!connected) {
    return (
      <button
        onClick={openPicker}
        disabled={connecting}
        className="rounded-xl bg-brand-strong px-3.5 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50 sm:px-5"
      >
        {connecting ? (
          "Connecting…"
        ) : (
          <>
            <span className="sm:hidden">Connect</span>
            <span className="hidden sm:inline">Connect Wallet</span>
          </>
        )}
      </button>
    );
  }

  const short = address ? `${address.slice(0, 4)}..${address.slice(-4)}` : "";
  const chainName = getChain(chainId)?.name ?? "Explorer";

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard
      ?.writeText(address)
      .then(() => setJustCopied(true))
      .catch(() => {});
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setMenuOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="flex items-center gap-2 rounded-xl bg-brand-strong px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110"
      >
        {selectedWalletIcon && (
          <img src={selectedWalletIcon} alt="" className="h-4 w-4 rounded" />
        )}
        <span className="font-mono">{short}</span>
        <ChevronDownIcon
          className={`h-3.5 w-3.5 transition-transform ${menuOpen ? "rotate-180" : ""}`}
        />
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 animate-fade-in overflow-hidden rounded-2xl border border-line bg-card shadow-xl shadow-black/20"
        >
          {/* Identity header */}
          <div className="flex items-center gap-3 border-b border-line bg-gradient-to-br from-brand-soft/60 to-transparent p-4">
            {selectedWalletIcon ? (
              <img src={selectedWalletIcon} alt="" className="h-10 w-10 rounded-xl" />
            ) : (
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-bg-soft font-mono text-sm font-bold text-ink-dim ring-1 ring-line">
                {short.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              {selectedWallet && (
                <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">
                  {selectedWallet}
                </p>
              )}
              <p className="truncate font-mono text-sm font-bold text-ink">{short}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="p-1.5">
            <button
              role="menuitem"
              onClick={copyAddress}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ink transition hover:bg-bg-soft"
            >
              {justCopied ? (
                <CheckIcon className="h-4 w-4 text-up" />
              ) : (
                <CopyIcon className="h-4 w-4 text-ink-dim" />
              )}
              {justCopied ? "Copied!" : "Copy address"}
            </button>

            <button
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                navigate("/portfolio");
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ink transition hover:bg-bg-soft"
            >
              <WalletIcon className="h-4 w-4 text-ink-dim" />
              My portfolio
            </button>

            <a
              role="menuitem"
              href={address ? explorerAccountUrl(chainId, address) : "#"}
              target="_blank"
              rel="noreferrer"
              onClick={() => setMenuOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ink transition hover:bg-bg-soft"
            >
              <ExternalLinkIcon className="h-4 w-4 text-ink-dim" />
              View on {chainName}
            </a>

            <div className="my-1 border-t border-line" />

            <button
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                void disconnect();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-danger transition hover:bg-danger/10"
            >
              <LogoutIcon className="h-4 w-4" />
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 3h6v6" />
      <path d="M10 14L21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
