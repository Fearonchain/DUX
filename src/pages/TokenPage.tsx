import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import bs58 from "bs58";
import { API_BASE } from "../lib/config";
import { useWallet, WalletButton } from "../components/WalletProviders";
import { shortenAddress, type TokenProfile } from "../lib/types";
import { fetchMarketPair, fetchTrades, type MarketPair, type Trade } from "../lib/market";
import TokenHeader from "../components/token/TokenHeader";
import PriceChart from "../components/token/PriceChart";
import EmbedChartDialog from "../components/token/EmbedChartDialog";
import StatsPanel from "../components/token/StatsPanel";
import TransactionsTable from "../components/token/TransactionsTable";
import { Skeleton, Spinner } from "../components/ui/Skeleton";
import WatchButton from "../components/WatchButton";
import AlertForm from "../components/watchlist/AlertForm";
import AlertList from "../components/watchlist/AlertList";
import { useWatchlist } from "../lib/watchlist";

const MARKET_REFRESH_MS = 20000;

export default function TokenPage() {
  const { address = "" } = useParams();
  const { address: walletAddress, signMessage, connected } = useWallet();
  const { alertsForToken } = useWatchlist();

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

  const bannerPreview = useMemo(
    () => (bannerFile ? URL.createObjectURL(bannerFile) : (profile?.header ?? null)),
    [bannerFile, profile]
  );

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/token-profiles/solana/${address}`, { cache: "no-store" });
      if (res.ok) {
        const p: TokenProfile = await res.json();
        setProfile(p);
        setDescription(p.description ?? "");
        const ls = p.links ?? [];
        setWebsiteUrl(ls.find((l) => l.type === "website")?.url ?? "");
        setTwitterUrl(ls.find((l) => l.type === "twitter")?.url ?? "");
      } else {
        setProfile(null);
      }
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Live market data: pair stats + recent trades, refreshed on an interval.
  useEffect(() => {
    let stop = false;
    setMarketLoading(true);
    setPair(null);
    setTrades([]);

    async function loadMarket(initial: boolean) {
      const p = await fetchMarketPair(address);
      if (stop) return;
      setPair(p);
      if (p) {
        const t = await fetchTrades(p.pairAddress);
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
  }, [address]);

  async function verify() {
    if (!walletAddress) return;
    setVerifying(true);
    setMsg(null);
    try {
      const wallet = walletAddress;
      const nonceRes = await fetch(`${API_BASE}/auth/nonce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, tokenAddress: address }),
      });
      if (!nonceRes.ok) throw new Error((await nonceRes.json()).error ?? "nonce request failed");
      const { nonce, message } = await nonceRes.json();

      const sig = await signMessage(new TextEncoder().encode(message));

      const verifyRes = await fetch(`${API_BASE}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, tokenAddress: address, nonce, signature: bs58.encode(sig) }),
      });
      const data = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(data.detail ?? data.error ?? "verification failed");
      setEditToken(data.editToken);
      setRole(data.role);
      setMsg({ kind: "ok", text: `Verified (${data.role}). ${data.detail}` });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setVerifying(false);
    }
  }

  /**
   * Convert any browser-readable image into a clean 1500x500 JPEG before
   * upload (cover-crop). This makes huge photos, webp, etc. just work; the
   * server still re-validates and re-encodes it.
   */
  async function prepareBanner(file: File): Promise<Blob> {
    const bitmap = await createImageBitmap(file).catch(() => null);
    let source: CanvasImageSource;
    let sw: number;
    let sh: number;
    if (bitmap) {
      source = bitmap;
      sw = bitmap.width;
      sh = bitmap.height;
    } else {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("Could not read this image file"));
      });
      source = img;
      sw = img.naturalWidth;
      sh = img.naturalHeight;
    }
    const TW = 1500;
    const TH = 500;
    const scale = Math.max(TW / sw, TH / sh);
    const cw = TW / scale;
    const ch = TH / scale;
    const sx = (sw - cw) / 2;
    const sy = (sh - ch) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = TW;
    canvas.height = TH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process the image");
    ctx.drawImage(source, sx, sy, cw, ch, 0, 0, TW, TH);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.86));
    if (!blob) throw new Error("Could not process the image");
    return blob;
  }

  async function save() {
    if (!editToken) return;
    setSaving(true);
    setMsg(null);
    try {
      const links: { type: string; url: string }[] = [];
      if (websiteUrl.trim()) links.push({ type: "website", url: websiteUrl.trim() });
      if (twitterUrl.trim()) links.push({ type: "twitter", url: twitterUrl.trim() });
      const form = new FormData();
      form.set(
        "payload",
        JSON.stringify({
          description: description.trim() || null,
          links,
        })
      );
      if (bannerFile) {
        const prepared = await prepareBanner(bannerFile);
        form.set("banner", new File([prepared], "banner.jpg", { type: "image/jpeg" }));
      }

      const res = await fetch(`${API_BASE}/profile`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${editToken}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? data.error ?? "save failed");
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

  return (
    <div className="flex flex-col gap-4 pb-10">
      {/* top bar */}
      <div className="flex items-center justify-between gap-4">
        <Link to="/" className="text-sm text-ink-dim transition hover:text-ink">
          ← Back
        </Link>
        <div className="flex items-center gap-2.5">
          <WatchButton address={address} />
          <WalletButton />
        </div>
      </div>

      {/* identity + live price (banner overlaid when present) */}
      {pair ? (
        <TokenHeader
          address={address}
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
        <div className="flex flex-col gap-4 lg:col-span-2">
          <PriceChart
            pairAddress={pair?.pairAddress ?? null}
            onEmbedClick={() => setEmbedOpen(true)}
          />
          {pair && (
            <TransactionsTable
              trades={trades}
              baseSymbol={pair.baseSymbol}
              loading={marketLoading}
            />
          )}
        </div>

        {/* right column: stats + DUX enhanced info + editing */}
        <div className="flex flex-col gap-4">
          {pair && <StatsPanel pair={pair} />}

          {/* DUX enhanced token info (the product itself) */}
          <section className="overflow-hidden rounded-2xl border border-line bg-card">
            <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-dim">
                Enhanced Info
              </span>
              <span className="ml-auto rounded-md bg-brand-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
                DUX
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

          {/* Watchlist price alerts for this token (stored locally). */}
          <section className="rounded-2xl border border-line bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <h3 className="font-semibold">Price alerts</h3>
              <WatchButton address={address} compact className="ml-auto" />
            </div>
            <AlertForm
              address={address}
              currentPrice={pair?.priceUsd ?? null}
              currentMarketCap={pair?.marketCap ?? null}
            />
            {alertsForToken(address).length > 0 && (
              <div className="mt-4">
                <AlertList alerts={alertsForToken(address)} />
              </div>
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
              GET /token-profiles/solana/{address}
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
          symbol={pair?.baseSymbol}
          onClose={() => setEmbedOpen(false)}
        />
      )}
    </div>
  );
}
