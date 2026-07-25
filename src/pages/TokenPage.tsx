import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { API_BASE } from "../lib/config";
import { useWallet, WalletButton } from "../components/WalletProviders";
import { shortenAddress, type TokenProfile } from "../lib/types";
import { prepareBannerImage, saveTokenProfile, verifyTokenOwnership } from "../lib/tokenClaim";
import { fetchMarketPair, fetchTrades, type MarketPair, type Trade } from "../lib/market";
import {
  DEFAULT_CHAIN_ID,
  chainTypeOf,
  getChain,
  isValidAddressForChain,
} from "../lib/chains";
import TokenHeader from "../components/token/TokenHeader";
import PriceChart from "../components/token/PriceChart";
import EmbedChartDialog from "../components/token/EmbedChartDialog";
import StatsPanel from "../components/token/StatsPanel";
import HoldingValue from "../components/token/HoldingValue";
import TransactionsTable from "../components/token/TransactionsTable";
import { Skeleton, Spinner } from "../components/ui/Skeleton";
import WatchButton from "../components/WatchButton";
import AlertForm from "../components/watchlist/AlertForm";
import AlertList from "../components/watchlist/AlertList";
import { useWatchlist } from "../lib/watchlist";

const MARKET_REFRESH_MS = 20000;

export default function TokenPage() {
  const { chainId = DEFAULT_CHAIN_ID, address = "" } = useParams();
  const {
    address: walletAddress,
    chainType: walletChainType,
    signMessage,
    connected,
  } = useWallet();
  const { alertsForToken } = useWatchlist();

  const chainName = getChain(chainId)?.name ?? "Solana";

  const [profile, setProfile] = useState<TokenProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editToken, setEditToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  const [pair, setPair] = useState<MarketPair | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [embedOpen, setEmbedOpen] = useState(false);
  // Alerts are a niche feature, so the panel starts collapsed and users expand
  // it only when they actually want to set one.
  const [alertsOpen, setAlertsOpen] = useState(false);

  // Basic client-side sanity check so garbage in the URL renders a friendly
  // message instead of firing doomed API calls for an obviously-invalid token.
  const isValidAddress = useMemo(
    () => isValidAddressForChain(chainId, address),
    [chainId, address]
  );

  const bannerPreview = useMemo(
    () => (bannerFile ? URL.createObjectURL(bannerFile) : (profile?.header ?? null)),
    [bannerFile, profile]
  );

  function clearProfileFields() {
    setProfile(null);
    setDescription("");
    setWebsiteUrl("");
    setTwitterUrl("");
  }

  const loadProfile = useCallback(async () => {
    if (!isValidAddress) {
      clearProfileFields();
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/token-profiles/${chainId}/${address}`, { cache: "no-store" });
      if (res.ok) {
        const p: TokenProfile = await res.json();
        setProfile(p);
        setDescription(p.description ?? "");
        const ls = p.links ?? [];
        setWebsiteUrl(ls.find((l) => l.type === "website")?.url ?? "");
        setTwitterUrl(ls.find((l) => l.type === "twitter")?.url ?? "");
      } else {
        clearProfileFields();
      }
    } catch {
      clearProfileFields();
    } finally {
      setLoading(false);
    }
  }, [chainId, address, isValidAddress]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Reset all token-scoped edit/verification state when switching tokens so a
  // previous token's edit session can never bleed into a different mint.
  useEffect(() => {
    setEditToken(null);
    setRole(null);
    setMsg(null);
    setVerifying(false);
    setBannerFile(null);
    if (bannerInput.current) bannerInput.current.value = "";
  }, [chainId, address]);

  // Live market data: pair stats + recent trades, refreshed on an interval.
  useEffect(() => {
    let stop = false;
    setMarketLoading(true);
    setPair(null);
    setTrades([]);
    if (!isValidAddress) {
      setMarketLoading(false);
      return;
    }

    async function loadMarket(initial: boolean) {
      const p = await fetchMarketPair(address, chainId);
      if (stop) return;
      setPair(p);
      if (p) {
        const t = await fetchTrades(p.pairAddress, chainId);
        if (!stop) setTrades(t);
      }
      if (initial && !stop) setMarketLoading(false);
    }

    loadMarket(true);
    const iv = setInterval(() => loadMarket(false), MARKET_REFRESH_MS);
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, [chainId, address, isValidAddress]);

  async function verify() {
    if (!walletAddress) return;
    // The connected wallet must be on the same chain family as the token, or the
    // signature/qualification will be meaningless. Prompt the user to switch.
    if (walletChainType !== chainTypeOf(chainId)) {
      setMsg({
        kind: "err",
        text: `Connect a ${chainName} wallet to verify this token, then try again.`,
      });
      return;
    }
    setVerifying(true);
    setMsg(null);
    try {
      const result = await verifyTokenOwnership({
        chainId,
        wallet: walletAddress,
        tokenAddress: address,
        signMessage,
      });
      setEditToken(result.editToken);
      setRole(result.role);
      setMsg({ kind: "ok", text: `Verified (${result.role}). ${result.detail}` });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setVerifying(false);
    }
  }

  async function save() {
    if (!editToken) return;
    setSaving(true);
    setMsg(null);
    try {
      const links: { type: string; url: string }[] = [];
      if (websiteUrl.trim()) links.push({ type: "website", url: websiteUrl.trim() });
      if (twitterUrl.trim()) links.push({ type: "twitter", url: twitterUrl.trim() });
      await saveTokenProfile(editToken, {
        description: description.trim() || null,
        links,
        bannerBlob: bannerFile ? await prepareBannerImage(bannerFile) : null,
      });
      setMsg({ kind: "ok", text: "Saved. Live instantly via the API." });
      setBannerFile(null);
      if (bannerInput.current) bannerInput.current.value = "";
      await loadProfile();
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "rounded-lg border border-line bg-bg-soft px-3 py-2.5 text-sm outline-none focus:border-brand";

  if (!isValidAddress) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">Invalid token address</h1>
        <p className="mx-auto mt-2 max-w-md text-ink-dim">
          That doesn't look like a valid {chainName} token address. Double-check the link and try again.
        </p>
        <Link
          to="/"
          className="mt-5 inline-block rounded-xl bg-brand-strong px-5 py-2.5 font-bold text-white transition hover:brightness-110"
        >
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-10">
      {/* top bar */}
      <div className="flex items-center justify-between gap-4">
        <Link to="/" className="text-sm text-ink-dim transition hover:text-ink">
          ← Back
        </Link>
        <div className="flex items-center gap-2.5">
          <WatchButton address={address} chainId={chainId} />
          <WalletButton />
        </div>
      </div>

      {/* identity + live price (banner overlaid when present) */}
      {pair ? (
        <TokenHeader
          address={address}
          chainId={chainId}
          name={pair.baseName}
          symbol={pair.baseSymbol}
          imageUrl={pair.imageUrl ?? profile?.icon ?? null}
          bannerUrl={bannerPreview}
          priceUsd={pair.priceUsd}
          change24h={pair.priceChange.h24}
          dexId={pair.dexId}
        />
      ) : marketLoading ? (
        <div className="flex items-center gap-3.5 rounded-2xl border border-line bg-card p-4">
          <Skeleton className="h-14 w-14 shrink-0 rounded-2xl" />
          <div className="flex-1">
            <Skeleton className="h-5 w-40 rounded-full" />
            <Skeleton className="mt-2 h-3.5 w-24 rounded-full" />
          </div>
          <div className="hidden text-right sm:block">
            <Skeleton className="ml-auto h-6 w-28 rounded-full" />
            <Skeleton className="ml-auto mt-2 h-3.5 w-16 rounded-full" />
          </div>
        </div>
      ) : bannerPreview ? (
        <div className="relative flex min-h-[160px] flex-col justify-end overflow-hidden rounded-2xl border border-line p-4 sm:aspect-[3/1] sm:max-h-[200px]">
          <img
            src={bannerPreview}
            alt="token banner"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/30" />
          <div className="relative flex items-center gap-3.5">
            <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl border border-white/20 bg-black/30">
              {profile?.icon ? (
                <img src={profile.icon} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="font-mono text-lg font-bold text-white/80">SOL</span>
              )}
            </div>
            <div>
              <h1 className="font-mono text-lg font-semibold text-white">{shortenAddress(address)}</h1>
              <p className="text-sm text-white/80">No live market found for this token yet.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3.5 rounded-2xl border border-line bg-card p-4">
          <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl border border-line bg-bg-soft">
            {profile?.icon ? (
              <img src={profile.icon} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="font-mono text-lg font-bold text-ink-dim">SOL</span>
            )}
          </div>
          <div>
            <h1 className="font-mono text-lg font-semibold">{shortenAddress(address)}</h1>
            <p className="text-sm text-ink-dim">No live market found for this token yet.</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* left column: chart + trades */}
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <PriceChart
            pairAddress={pair?.pairAddress ?? null}
            chainId={chainId}
            onEmbedClick={() => setEmbedOpen(true)}
          />
          {pair && (
            <TransactionsTable
              trades={trades}
              baseSymbol={pair.baseSymbol}
              loading={marketLoading}
              chainId={chainId}
            />
          )}
        </div>

        {/* right column: stats + DUX enhanced info + editing */}
        <div className="flex min-w-0 flex-col gap-4">
          {pair && <StatsPanel pair={pair} />}

          {pair && chainTypeOf(chainId) === "solana" && (
            <HoldingValue
              address={address}
              priceUsd={pair.priceUsd}
              symbol={pair.baseSymbol}
            />
          )}

          {/* DUX enhanced token info (the product itself) */}
          <section className="overflow-hidden rounded-2xl border border-line bg-card">
            <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-dim">
                Enhanced Info
              </span>
              <span className="ml-auto rounded-md bg-brand-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
                Torch
              </span>
            </div>
            <div className="p-4">
              <p className="mb-2 text-sm">
                {description || <span className="text-ink-dim">No description yet.</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                {websiteUrl.trim() && (
                  <a
                    href={websiteUrl.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-line bg-bg-soft px-2.5 py-0.5 text-xs text-ink-dim transition hover:border-brand hover:text-brand"
                  >
                    website
                  </a>
                )}
                {twitterUrl.trim() && (
                  <a
                    href={twitterUrl.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-line bg-bg-soft px-2.5 py-0.5 text-xs text-ink-dim transition hover:border-brand hover:text-brand"
                  >
                    X
                  </a>
                )}
              </div>
            </div>
          </section>

          {/* Watchlist price alerts for this token (stored locally). Collapsed
              by default since most visitors don't set alerts. */}
          <section className="rounded-2xl border border-line bg-card p-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAlertsOpen((open) => !open)}
                aria-expanded={alertsOpen}
                className="flex flex-1 items-center gap-2 text-left"
              >
                <h3 className="font-semibold">Price alerts</h3>
                {alertsForToken(address).length > 0 && (
                  <span className="rounded-full bg-brand-soft px-1.5 py-0.5 text-[11px] font-bold text-brand">
                    {alertsForToken(address).length}
                  </span>
                )}
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                  className={`ml-auto h-4 w-4 text-ink-dim transition-transform ${
                    alertsOpen ? "rotate-180" : ""
                  }`}
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 1 1 1.08 1.04l-4.25 4.39a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              <WatchButton address={address} chainId={chainId} compact />
            </div>
            {alertsOpen && (
              <>
                <div className="mt-3">
                  <AlertForm
                    address={address}
                    chainId={chainId}
                    currentPrice={pair?.priceUsd ?? null}
                    currentMarketCap={pair?.marketCap ?? null}
                  />
                </div>
                {alertsForToken(address).length > 0 && (
                  <div className="mt-4">
                    <AlertList alerts={alertsForToken(address)} />
                  </div>
                )}
              </>
            )}
          </section>

          {loading && (
            <span className="text-ink-dim">
              <Spinner className="h-4 w-4" label="Loading profile…" />
            </span>
          )}

          {!editToken && (
            <section className="rounded-2xl border border-line bg-card p-4">
              <h3 className="mb-2 font-semibold">Unlock editing</h3>
              <p className="mb-4 text-sm text-ink-dim">
                Connect the wallet that is either the token authority (dev wallet / pump.fun
                creator) or holds at least 3% of the supply. You only sign a message: no
                transaction, no cost, no access to your funds.
              </p>
              <button
                onClick={verify}
                disabled={!connected || verifying}
                className="w-full rounded-xl bg-brand px-6 py-3 font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {verifying ? (
                  <Spinner className="h-4 w-4" label="Checking on-chain…" />
                ) : connected ? (
                  "Verify with wallet"
                ) : (
                  "Connect wallet first"
                )}
              </button>
              <Link
                to={`/add/${chainId}/${address}`}
                className="mt-3 block text-center text-sm font-semibold text-brand hover:underline"
              >
                Prefer a guided step-by-step flow? →
              </Link>
            </section>
          )}

          {editToken && (
            <section className="rounded-2xl border border-line bg-card p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold">Edit token info</h3>
                <span className="rounded-md bg-brand px-2.5 py-0.5 text-xs font-bold text-white">
                  {role}
                </span>
              </div>

              <label className="mb-4 flex flex-col gap-1.5">
                <span className="text-[13px] text-ink-dim">
                  Banner (any image, will be cropped to 1500×500)
                </span>
                <input
                  ref={bannerInput}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setBannerFile(e.target.files?.[0] ?? null)}
                  className={inputCls}
                />
              </label>

              <label className="mb-4 flex flex-col gap-1.5">
                <span className="text-[13px] text-ink-dim">Description (max 600 characters)</span>
                <textarea
                  value={description}
                  maxLength={600}
                  rows={3}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this token?"
                  className={`${inputCls} resize-y`}
                />
              </label>

              <label className="mb-4 flex flex-col gap-1.5">
                <span className="text-[13px] text-ink-dim">Website (https)</span>
                <input
                  placeholder="https://yourproject.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className={inputCls}
                />
              </label>

              <label className="mb-4 flex flex-col gap-1.5">
                <span className="text-[13px] text-ink-dim">X (Twitter) link</span>
                <input
                  placeholder="https://x.com/yourproject"
                  value={twitterUrl}
                  onChange={(e) => setTwitterUrl(e.target.value)}
                  className={inputCls}
                />
              </label>

              <button
                onClick={save}
                disabled={saving}
                className="w-full rounded-xl bg-brand px-6 py-3 font-bold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {saving ? <Spinner className="h-4 w-4" label="Saving…" /> : "Save"}
              </button>
            </section>
          )}

          {msg && (
            <p className={`text-sm ${msg.kind === "ok" ? "text-up" : "text-down"}`}>{msg.text}</p>
          )}

          <section className="rounded-2xl border border-line bg-card p-4">
            <h3 className="mb-2 font-semibold">For integrators</h3>
            <p className="text-sm text-ink-dim">This data is publicly available right away:</p>
            <code className="my-2 block overflow-x-auto rounded-lg border border-line bg-bg-soft px-3.5 py-2.5 font-mono text-[12px]">
              GET /token-profiles/{chainId}/{address}
            </code>
            <Link to="/docs" className="text-sm text-ink-dim hover:text-ink">
              → full API documentation
            </Link>
          </section>
        </div>
      </div>

      {embedOpen && (
        <EmbedChartDialog
          address={address}
          chainId={chainId}
          symbol={pair?.baseSymbol}
          onClose={() => setEmbedOpen(false)}
        />
      )}
    </div>
  );
}
