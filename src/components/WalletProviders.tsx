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

type InjectedProvider = {
  publicKey?: { toBase58(): string } | null;
  connect(): Promise<unknown>;
  disconnect(): Promise<void>;
  signMessage(message: Uint8Array, encoding?: string): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  off?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
};

type WalletName = "Phantom" | "Solflare";

function getProvider(name: WalletName): InjectedProvider | undefined {
  const w = window as unknown as Record<string, any>;
  if (name === "Phantom") {
    if (w.phantom?.solana?.isPhantom) return w.phantom.solana;
    if (w.solana?.isPhantom) return w.solana;
    return undefined;
  }
  if (w.solflare?.isSolflare) return w.solflare;
  return undefined;
}

interface WalletState {
  address: string | null;
  selectedWallet: WalletName | null;
  connected: boolean;
  connecting: boolean;
  openPicker: () => void;
  disconnect: () => Promise<void>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
}

const WalletCtx = createContext<WalletState | null>(null);

export function useWallet(): WalletState {
  const ctx = useContext(WalletCtx);
  if (!ctx) throw new Error("useWallet must be used inside WalletProviders");
  return ctx;
}

function extractAddress(res: unknown, provider: InjectedProvider): string | null {
  const r = res as { publicKey?: { toBase58(): string } } | undefined;
  if (r?.publicKey?.toBase58) return r.publicKey.toBase58();
  if (provider.publicKey?.toBase58) return provider.publicKey.toBase58();
  return null;
}

export default function WalletProviders({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<WalletName | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const providerRef = useRef<InjectedProvider | null>(null);

  const cleanupListeners = useRef<(() => void) | null>(null);

  const attachListeners = useCallback((provider: InjectedProvider) => {
    const onDisconnect = () => {
      setAddress(null);
      setSelectedWallet(null);
      providerRef.current = null;
    };
    const onAccountChanged = (...args: unknown[]) => {
      const pk = args[0] as { toBase58?: () => string } | null | undefined;
      if (pk?.toBase58) {
        setAddress(pk.toBase58());
      } else if (provider.publicKey?.toBase58) {
        setAddress(provider.publicKey.toBase58());
      } else {
        onDisconnect();
      }
    };
    provider.on?.("disconnect", onDisconnect);
    provider.on?.("accountChanged", onAccountChanged);
    cleanupListeners.current = () => {
      (provider.off ?? provider.removeListener)?.call(provider, "disconnect", onDisconnect);
      (provider.off ?? provider.removeListener)?.call(provider, "accountChanged", onAccountChanged);
    };
  }, []);

  useEffect(() => () => cleanupListeners.current?.(), []);

  const connectTo = useCallback(
    async (name: WalletName) => {
      const provider = getProvider(name);
      if (!provider) {
        window.open(
          name === "Phantom" ? "https://phantom.com/download" : "https://solflare.com/download",
          "_blank",
          "noreferrer"
        );
        return;
      }
      setConnecting(true);
      try {
        const res = await provider.connect();
        const addr = extractAddress(res, provider);
        if (addr) {
          cleanupListeners.current?.();
          providerRef.current = provider;
          setAddress(addr);
          setSelectedWallet(name);
          attachListeners(provider);
          setPickerOpen(false);
        }
      } catch {
        /* user rejected the connect prompt */
      } finally {
        setConnecting(false);
      }
    },
    [attachListeners]
  );

  const disconnect = useCallback(async () => {
    const provider = providerRef.current;
    cleanupListeners.current?.();
    cleanupListeners.current = null;
    providerRef.current = null;
    setAddress(null);
    setSelectedWallet(null);
    try {
      await provider?.disconnect();
    } catch {
      /* ignore */
    }
  }, []);

  const signMessage = useCallback(async (message: Uint8Array): Promise<Uint8Array> => {
    const provider = providerRef.current;
    if (!provider) throw new Error("Wallet not connected");
    const res = await provider.signMessage(message, "utf8");
    if (res instanceof Uint8Array) return res;
    const r = res as { signature?: Uint8Array | number[] };
    if (r?.signature) return new Uint8Array(r.signature as ArrayLike<number>);
    throw new Error("Wallet returned no signature");
  }, []);

  const value = useMemo<WalletState>(
    () => ({
      address,
      selectedWallet,
      connected: address !== null,
      connecting,
      openPicker: () => setPickerOpen(true),
      disconnect,
      signMessage,
    }),
    [address, selectedWallet, connecting, disconnect, signMessage]
  );

  return (
    <WalletCtx.Provider value={value}>
      {children}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl border border-line bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">Connect a wallet</h3>
              <button
                onClick={() => setPickerOpen(false)}
                className="rounded-md px-2 text-ink-dim hover:text-ink"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            {(["Phantom", "Solflare"] as WalletName[]).map((name) => (
              <button
                key={name}
                onClick={() => connectTo(name)}
                disabled={connecting}
                className="mb-2 flex w-full items-center justify-between rounded-xl border border-line px-4 py-3 text-left text-sm font-semibold hover:border-ink disabled:opacity-50"
              >
                {name}
                <span className="text-xs font-normal text-ink-dim">
                  {getProvider(name) ? (connecting ? "Connecting…" : "Detected") : "Install"}
                </span>
              </button>
            ))}
            <p className="mt-3 text-[11px] text-ink-dim">
              You will only sign messages, never transactions. To use a different account, switch
              it inside your wallet extension.
            </p>
          </div>
        </div>
      )}
    </WalletCtx.Provider>
  );
}

/** Connect button with a small menu when connected. */
export function WalletButton() {
  const { address, connected, connecting, openPicker, disconnect } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!connected) {
    return (
      <button
        onClick={openPicker}
        disabled={connecting}
        className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-bg transition hover:bg-accent-dark disabled:opacity-50"
      >
        {connecting ? "Connecting…" : "Select Wallet"}
      </button>
    );
  }

  const short = address ? `${address.slice(0, 4)}..${address.slice(-4)}` : "";
  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((o) => !o)}
        className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-bg transition hover:bg-accent-dark"
      >
        {short}
      </button>
      {menuOpen && (
        <div className="absolute right-0 z-50 mt-2 w-44 rounded-xl border border-line bg-card p-1.5 shadow-lg">
          <button
            onClick={() => {
              if (address) navigator.clipboard?.writeText(address).catch(() => {});
              setMenuOpen(false);
            }}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-bg-soft"
          >
            Copy address
          </button>
          <button
            onClick={() => {
              setMenuOpen(false);
              void disconnect();
            }}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-bg-soft"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
