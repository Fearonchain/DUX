import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../lib/config";
import { useWallet } from "../components/WalletProviders";
import { FlameMark } from "../components/Logo";
import { Spinner } from "../components/ui/Skeleton";
import { shortenAddress, type TokenProfile } from "../lib/types";
import {
  fetchMarketPair,
  fetchTokenBriefs,
  formatPriceUsd,
  searchTokens,
  type TokenSearchResult,
} from "../lib/market";
import { resolveTokenAcrossChains } from "../lib/market";
import { fetchDuxProfileStatus } from "../lib/profiles";
import {
  DEFAULT_CHAIN_ID,
  chainTypeOf,
  getChain,
  isValidAddressForChain,
  isValidEvmAddress,
  isValidSolanaAddress,
} from "../lib/chains";
import {
  prepareBannerImage,
  saveTokenProfile,
  verifyTokenOwnership,
} from "../lib/tokenClaim";

/**
 * "Add your token" — a friendly, guided wizard that walks anyone through
 * putting verified enhanced info on Torch in four small steps:
 *
 *   1. Find    — search by name/ticker or paste the mint address.
 *   2. Verify  — one free wallet signature proves you control the token.
 *   3. Customize — banner, description and links, with a live preview.
 *   4. Live    — it's published instantly via the public API.
 *
 * The heavy lifting (verify / save / banner processing) lives in lib/tokenClaim
 * so this screen and the classic token page stay perfectly in sync.
 */

const STEPS = ["Find", "Verify", "Customize", "Live"] as const;
type StepName = (typeof STEPS)[number];
const SEARCH_DEBOUNCE_MS = 250;

/** The token the user picked in step 1, carried through the rest of the flow. */
interface ChosenToken {
  address: string;
  chainId: string;
  name: string;
  symbol: string;
  imageUrl: string | null;
  priceUsd: number;
  alreadyOnTorch: boolean;
}

export default function AddToken() {
  const navigate = useNavigate();
  const { chainId: routeChainId, address: routeAddress } = useParams();
  const {
    address: walletAddress,
    chainType: walletChainType,
    connected,
    openPicker,
    signMessage,
  } = useWallet();

  const [step, setStep] = useState<StepName>("Find");
  const [chosen, setChosen] = useState<ChosenToken | null>(null);

  // Verification state.
  const [editToken, setEditToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Customize state.
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [existingHeader, setExistingHeader] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const stepIndex = STEPS.indexOf(step);

  /** Move to a token and jump straight to verification. */
  const chooseToken = useCallback((token: ChosenToken) => {
    setChosen(token);
    setEditToken(null);
    setRole(null);
    setVerifyError(null);
    setStep("Verify");
  }, []);

  // If the URL carried a valid mint (e.g. from a token page CTA), resolve its
  // identity and drop the user straight onto the verify step.
  const bootstrappedRef = useRef(false);
  useEffect(() => {
    if (bootstrappedRef.current) return;
    const chainId = routeChainId ?? DEFAULT_CHAIN_ID;
    if (!routeAddress || !isValidAddressForChain(chainId, routeAddress)) return;
    bootstrappedRef.current = true;
    (async () => {
      const [briefs, status] = await Promise.all([
        fetchTokenBriefs([routeAddress], chainId),
        fetchDuxProfileStatus(routeAddress, chainId),
      ]);
      const brief = briefs[routeAddress];
      chooseToken({
        address: routeAddress,
        chainId,
        name: brief?.name ?? "",
        symbol: brief?.symbol ?? "",
        imageUrl: brief?.imageUrl ?? null,
        priceUsd: 0,
        alreadyOnTorch: status.hasProfile,
      });
    })();
  }, [routeChainId, routeAddress, chooseToken]);

  async function handleVerify() {
    if (!walletAddress || !chosen) return;
    // The connected wallet must match the token's chain family (an EVM wallet
    // can't sign for a Solana token and vice-versa).
    const tokenChainType = chainTypeOf(chosen.chainId);
    if (walletChainType && walletChainType !== tokenChainType) {
      const chainName = getChain(chosen.chainId)?.name ?? chosen.chainId;
      setVerifyError(
        `This is a ${chainName} token. Switch to a ${tokenChainType === "solana" ? "Solana" : "an EVM"} wallet, then try again.`
      );
      return;
    }
    setVerifying(true);
    setVerifyError(null);
    try {
      const result = await verifyTokenOwnership({
        chainId: chosen.chainId,
        wallet: walletAddress,
        tokenAddress: chosen.address,
        signMessage,
      });
      setEditToken(result.editToken);
      setRole(result.role);
      await prefillExistingProfile(chosen.chainId, chosen.address);
      setStep("Customize");
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : String(e));
    } finally {
      setVerifying(false);
    }
  }

  /** Pull any info the token already has so edits start from the current state. */
  async function prefillExistingProfile(chainId: string, address: string) {
    try {
      const res = await fetch(`${API_BASE}/token-profiles/${chainId}/${address}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const profile: TokenProfile = await res.json();
      setDescription(profile.description ?? "");
      setExistingHeader(profile.header ?? null);
      const links = profile.links ?? [];
      setWebsiteUrl(links.find((l) => l.type === "website")?.url ?? "");
      setTwitterUrl(links.find((l) => l.type === "twitter")?.url ?? "");
    } catch {
      /* no existing profile — start blank */
    }
  }

  async function handlePublish() {
    if (!editToken) return;
    setSaving(true);
    setSaveError(null);
    try {
      const links: { type: string; url: string }[] = [];
      if (websiteUrl.trim()) links.push({ type: "website", url: websiteUrl.trim() });
      if (twitterUrl.trim()) links.push({ type: "twitter", url: twitterUrl.trim() });
      await saveTokenProfile(editToken, {
        description: description.trim() || null,
        links,
        bannerBlob: bannerFile ? await prepareBannerImage(bannerFile) : null,
      });
      setStep("Live");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl pb-16">
      <WizardHeader />
      <Stepper current={stepIndex} />

      <div className="mt-8">
        {step === "Find" && <FindStep onChoose={chooseToken} />}

        {step === "Verify" && chosen && (
          <VerifyStep
            token={chosen}
            connected={connected}
            walletAddress={walletAddress}
            verifying={verifying}
            error={verifyError}
            onConnect={openPicker}
            onVerify={handleVerify}
            onBack={() => setStep("Find")}
          />
        )}

        {step === "Customize" && chosen && (
          <CustomizeStep
            token={chosen}
            role={role}
            description={description}
            websiteUrl={websiteUrl}
            twitterUrl={twitterUrl}
            bannerFile={bannerFile}
            existingHeader={existingHeader}
            saving={saving}
            error={saveError}
            onDescription={setDescription}
            onWebsite={setWebsiteUrl}
            onTwitter={setTwitterUrl}
            onBanner={setBannerFile}
            onPublish={handlePublish}
          />
        )}

        {step === "Live" && chosen && (
          <LiveStep
            token={chosen}
            onView={() => navigate(`/token/${chosen.chainId}/${chosen.address}`)}
            onAddAnother={() => {
              setChosen(null);
              setEditToken(null);
              setRole(null);
              setDescription("");
              setWebsiteUrl("");
              setTwitterUrl("");
              setBannerFile(null);
              setExistingHeader(null);
              setStep("Find");
            }}
          />
        )}
      </div>
    </div>
  );
}

/* --- Header + stepper ----------------------------------------------------- */

function WizardHeader() {
  return (
    <div className="text-center">
      <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-bg-soft px-3.5 py-1.5 text-xs font-semibold text-ink-dim">
        <FlameMark className="h-3.5 w-3.5 text-brand" />
        Free forever · No $299 paywall
      </span>
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
        Put your token on{" "}
        <span className="bg-gradient-to-r from-brand to-brand-strong bg-clip-text text-transparent">
          Torch
        </span>
      </h1>
      <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-ink-dim">
        Banner, description and links — verified on-chain in about a minute. No forms, no fees,
        no waiting.
      </p>
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="mx-auto mt-8 flex max-w-md items-center">
      {STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold transition ${
                  done
                    ? "bg-brand text-white"
                    : active
                      ? "bg-brand-soft text-brand ring-2 ring-brand"
                      : "bg-bg-soft text-ink-dim"
                }`}
              >
                {done ? <CheckIcon className="h-4 w-4" /> : index + 1}
              </span>
              <span
                className={`text-[11px] font-semibold ${
                  active ? "text-ink" : "text-ink-dim"
                }`}
              >
                {label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <span
                className={`mx-1 mb-5 h-0.5 flex-1 rounded-full transition ${
                  done ? "bg-brand" : "bg-line"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* --- Step 1: Find --------------------------------------------------------- */

function FindStep({ onChoose }: { onChoose: (token: ChosenToken) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TokenSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = query.trim();
  const looksLikeSolana = isValidSolanaAddress(trimmed);
  const looksLikeEvm = isValidEvmAddress(trimmed);
  const looksLikeAddress = looksLikeSolana || looksLikeEvm;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced name/ticker search (skipped when the input is a raw mint address).
  useEffect(() => {
    if (looksLikeAddress || trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = await searchTokens(trimmed);
      if (cancelled) return;
      setResults(found.slice(0, 8));
      setLoading(false);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, looksLikeAddress]);

  async function chooseFromSearch(token: TokenSearchResult) {
    const status = await fetchDuxProfileStatus(token.address, token.chainId);
    onChoose({
      address: token.address,
      chainId: token.chainId,
      name: token.name,
      symbol: token.symbol,
      imageUrl: token.imageUrl,
      priceUsd: token.priceUsd,
      alreadyOnTorch: status.hasProfile,
    });
  }

  async function chooseFromAddress() {
    if (!looksLikeAddress) {
      setError("That doesn't look like a valid Solana or EVM token address.");
      return;
    }
    setResolving(true);
    setError(null);
    try {
      // Solana mints are unambiguous; for a 0x address, ask the market resolver
      // which EVM chain actually has the token (falls back to Ethereum).
      let chainId = DEFAULT_CHAIN_ID;
      if (looksLikeEvm) {
        const resolved = await resolveTokenAcrossChains(trimmed);
        chainId = resolved.chainId === DEFAULT_CHAIN_ID ? "ethereum" : resolved.chainId;
      }
      const [pair, briefs, status] = await Promise.all([
        fetchMarketPair(trimmed, chainId),
        fetchTokenBriefs([trimmed], chainId),
        fetchDuxProfileStatus(trimmed, chainId),
      ]);
      const brief = briefs[trimmed];
      onChoose({
        address: trimmed,
        chainId,
        name: pair?.baseName ?? brief?.name ?? "",
        symbol: pair?.baseSymbol ?? brief?.symbol ?? "",
        imageUrl: pair?.imageUrl ?? brief?.imageUrl ?? null,
        priceUsd: pair?.priceUsd ?? 0,
        alreadyOnTorch: status.hasProfile,
      });
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="animate-fade-in rounded-2xl border border-line bg-card p-5 sm:p-6">
      <h2 className="text-lg font-bold">Which token is yours?</h2>
      <p className="mt-1 text-sm text-ink-dim">
        Search by name or ticker, or paste the mint address (CA).
      </p>

      <div className="mt-4 flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-dim" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && looksLikeAddress) chooseFromAddress();
            }}
            placeholder="e.g. BONK, WIF, or a mint address…"
            spellCheck={false}
            className="w-full rounded-xl border border-line bg-bg-soft py-3 pl-10 pr-3 text-[15px] outline-none focus:border-accent"
          />
          {loading && (
            <Spinner className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-dim" />
          )}
        </div>
        {looksLikeAddress && (
          <button
            onClick={chooseFromAddress}
            disabled={resolving}
            className="shrink-0 rounded-xl bg-brand-strong px-5 font-bold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {resolving ? <Spinner className="h-4 w-4" /> : "Continue"}
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-down">{error}</p>}

      {/* Search results */}
      {!looksLikeAddress && trimmed.length >= 2 && (
        <div className="mt-3 space-y-1.5">
          {!loading && results.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-dim">
              No tokens found for “{trimmed}”. If it's brand new, paste its mint address instead.
            </p>
          ) : (
            results.map((token) => (
              <button
                key={`${token.chainId}:${token.address}`}
                onClick={() => chooseFromSearch(token)}
                className="flex w-full items-center gap-3 rounded-xl border border-line bg-bg-soft px-3 py-2.5 text-left transition hover:border-accent"
              >
                <TokenAvatar
                  imageUrl={token.imageUrl}
                  seed={token.name || token.symbol || token.address}
                  className="h-9 w-9"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">
                      {token.name || token.symbol || shortenAddress(token.address)}
                    </span>
                    {token.symbol && (
                      <span className="shrink-0 font-mono text-[11px] uppercase text-ink-dim">
                        {token.symbol}
                      </span>
                    )}
                  </div>
                  <p className="truncate font-mono text-[11px] text-ink-dim">
                    {shortenAddress(token.address)}
                  </p>
                </div>
                {token.priceUsd > 0 && (
                  <span className="shrink-0 text-sm font-semibold">
                    {formatPriceUsd(token.priceUsd)}
                  </span>
                )}
                <ArrowIcon className="h-4 w-4 shrink-0 text-ink-dim" />
              </button>
            ))
          )}
        </div>
      )}

      <p className="mt-4 flex items-start gap-1.5 text-[12px] text-ink-dim">
        <FlameMark className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
        Works for any Solana or EVM token — including brand-new pump.fun launches that aren't
        trading yet.
      </p>
    </div>
  );
}

/* --- Step 2: Verify ------------------------------------------------------- */

function VerifyStep({
  token,
  connected,
  walletAddress,
  verifying,
  error,
  onConnect,
  onVerify,
  onBack,
}: {
  token: ChosenToken;
  connected: boolean;
  walletAddress: string | null;
  verifying: boolean;
  error: string | null;
  onConnect: () => void;
  onVerify: () => void;
  onBack: () => void;
}) {
  return (
    <div className="animate-fade-in space-y-4">
      <TokenSummary token={token} onChange={onBack} />

      <div className="rounded-2xl border border-line bg-card p-5 sm:p-6">
        <h2 className="text-lg font-bold">Prove it's yours</h2>
        <p className="mt-1 text-sm text-ink-dim">
          Connect the wallet that qualifies for this token, then sign one message. It's free —
          no transaction, and Torch can never touch your funds.
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Qualifier
            title="Token authority"
            detail="Dev wallet or pump.fun creator"
          />
          <Qualifier title="Big holder" detail="Wallet holding ≥3% of supply" />
        </div>

        {!connected ? (
          <button
            onClick={onConnect}
            className="mt-5 w-full rounded-xl bg-brand-strong px-6 py-3.5 font-bold text-white transition hover:brightness-110"
          >
            Connect wallet
          </button>
        ) : (
          <>
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-line bg-bg-soft px-4 py-2.5 text-sm">
              <span className="h-2 w-2 rounded-full bg-up" />
              <span className="text-ink-dim">Connected</span>
              <span className="ml-auto font-mono font-semibold">
                {walletAddress ? shortenAddress(walletAddress) : ""}
              </span>
            </div>
            <button
              onClick={onVerify}
              disabled={verifying}
              className="mt-3 w-full rounded-xl bg-brand px-6 py-3.5 font-bold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {verifying ? (
                <Spinner className="h-4 w-4" label="Checking on-chain…" />
              ) : (
                "Sign to verify"
              )}
            </button>
          </>
        )}

        {error && (
          <div className="mt-3 rounded-xl border border-down/30 bg-down/5 px-4 py-3 text-sm text-down">
            {error}
          </div>
        )}

        <p className="mt-4 flex items-start gap-1.5 text-[12px] text-ink-dim">
          <ShieldIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
          Wrong wallet? Switch accounts inside your wallet extension, then try again.
        </p>
      </div>
    </div>
  );
}

function Qualifier({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-line bg-bg-soft p-3">
      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-[12px] text-ink-dim">{detail}</p>
      </div>
    </div>
  );
}

/* --- Step 3: Customize ---------------------------------------------------- */

function CustomizeStep({
  token,
  role,
  description,
  websiteUrl,
  twitterUrl,
  bannerFile,
  existingHeader,
  saving,
  error,
  onDescription,
  onWebsite,
  onTwitter,
  onBanner,
  onPublish,
}: {
  token: ChosenToken;
  role: string | null;
  description: string;
  websiteUrl: string;
  twitterUrl: string;
  bannerFile: File | null;
  existingHeader: string | null;
  saving: boolean;
  error: string | null;
  onDescription: (v: string) => void;
  onWebsite: (v: string) => void;
  onTwitter: (v: string) => void;
  onBanner: (f: File | null) => void;
  onPublish: () => void;
}) {
  const [dragging, setDragging] = useState(false);

  // Live banner preview: freshly chosen file wins, else the token's existing one.
  const bannerPreview = useMemo(
    () => (bannerFile ? URL.createObjectURL(bannerFile) : existingHeader),
    [bannerFile, existingHeader]
  );
  useEffect(() => {
    return () => {
      if (bannerFile && bannerPreview) URL.revokeObjectURL(bannerPreview);
    };
  }, [bannerFile, bannerPreview]);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) onBanner(file);
  }

  const inputCls =
    "w-full rounded-xl border border-line bg-bg-soft px-3.5 py-2.5 text-sm outline-none focus:border-brand";

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center gap-2">
        <TokenSummary token={token} className="flex-1" />
        {role && (
          <span className="shrink-0 self-stretch rounded-xl bg-brand px-3 py-1 text-xs font-bold uppercase tracking-wide text-white grid place-items-center">
            {role} ✓
          </span>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-card p-5 sm:p-6">
        <h2 className="text-lg font-bold">Make it shine</h2>
        <p className="mt-1 text-sm text-ink-dim">
          Everything here is optional — but a banner and a line of description go a long way.
        </p>

        {/* Live preview */}
        <div className="mt-4 overflow-hidden rounded-xl border border-line">
          <div className="relative h-28 bg-bg-soft sm:h-32">
            {bannerPreview ? (
              <img src={bannerPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-xs text-ink-dim">
                Banner preview (1500 × 500)
              </div>
            )}
            <div className="absolute -bottom-6 left-4">
              <TokenAvatar
                imageUrl={token.imageUrl}
                seed={token.name || token.symbol || token.address}
                className="h-12 w-12 ring-4 ring-card"
              />
            </div>
          </div>
          <div className="px-4 pb-3 pt-8">
            <p className="text-sm font-bold">
              {token.name || shortenAddress(token.address)}{" "}
              {token.symbol && (
                <span className="font-mono text-xs font-normal uppercase text-ink-dim">
                  {token.symbol}
                </span>
              )}
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs text-ink-dim">
              {description || "Your description will appear here."}
            </p>
          </div>
        </div>

        {/* Banner drop zone */}
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${
            dragging ? "border-brand bg-brand-soft/40" : "border-line bg-bg-soft hover:border-accent"
          }`}
        >
          <UploadIcon className="h-5 w-5 text-ink-dim" />
          <span className="text-sm font-semibold">
            {bannerFile ? bannerFile.name : "Drop a banner or click to upload"}
          </span>
          <span className="text-[11px] text-ink-dim">
            Any image — we'll crop it to 1500 × 500 for you.
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onBanner(e.target.files?.[0] ?? null)}
          />
        </label>

        <div className="mt-4 space-y-4">
          <label className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between text-[13px] text-ink-dim">
              <span>Description</span>
              <span>{description.length}/600</span>
            </span>
            <textarea
              value={description}
              maxLength={600}
              rows={3}
              onChange={(e) => onDescription(e.target.value)}
              placeholder="What is this token about?"
              className={`${inputCls} resize-y`}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] text-ink-dim">Website</span>
              <input
                value={websiteUrl}
                onChange={(e) => onWebsite(e.target.value)}
                placeholder="https://yourproject.com"
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] text-ink-dim">X (Twitter)</span>
              <input
                value={twitterUrl}
                onChange={(e) => onTwitter(e.target.value)}
                placeholder="https://x.com/yourproject"
                className={inputCls}
              />
            </label>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-down/30 bg-down/5 px-4 py-3 text-sm text-down">
            {error}
          </div>
        )}

        <button
          onClick={onPublish}
          disabled={saving}
          className="mt-5 w-full rounded-xl bg-brand-strong px-6 py-3.5 font-bold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {saving ? <Spinner className="h-4 w-4" label="Publishing…" /> : "Publish — go live"}
        </button>
      </div>
    </div>
  );
}

/* --- Step 4: Live --------------------------------------------------------- */

function LiveStep({
  token,
  onView,
  onAddAnother,
}: {
  token: ChosenToken;
  onView: () => void;
  onAddAnother: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/token/${token.chainId}/${token.address}`
      : `/token/${token.chainId}/${token.address}`;

  function copy() {
    navigator.clipboard?.writeText(shareUrl).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => {}
    );
  }

  return (
    <div className="animate-fade-in rounded-2xl border border-line bg-card p-6 text-center sm:p-8">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-brand">
        <FlameMark className="h-8 w-8 animate-pulse-dot" />
      </span>
      <h2 className="mt-4 text-2xl font-bold">You're live! 🔥</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink-dim">
        <span className="font-semibold text-ink">
          {token.name || token.symbol || shortenAddress(token.address)}
        </span>{" "}
        now has verified enhanced info on Torch — served instantly through the free public API.
      </p>

      <div className="mt-6 flex flex-col gap-2.5">
        <button
          onClick={onView}
          className="w-full rounded-xl bg-brand-strong px-6 py-3.5 font-bold text-white transition hover:brightness-110"
        >
          View your token
        </button>
        <button
          onClick={copy}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-bg-soft px-6 py-3 font-semibold transition hover:border-accent"
        >
          {copied ? <CheckIcon className="h-4 w-4 text-brand" /> : <CopyIcon className="h-4 w-4" />}
          {copied ? "Link copied" : "Copy share link"}
        </button>
        <button
          onClick={onAddAnother}
          className="w-full rounded-xl px-6 py-2.5 text-sm font-semibold text-ink-dim transition hover:text-ink"
        >
          Add another token
        </button>
      </div>
    </div>
  );
}

/* --- Shared bits ---------------------------------------------------------- */

function TokenSummary({
  token,
  onChange,
  className = "",
}: {
  token: ChosenToken;
  onChange?: () => void;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-line bg-card p-3.5 ${className}`}
    >
      <TokenAvatar
        imageUrl={token.imageUrl}
        seed={token.name || token.symbol || token.address}
        className="h-11 w-11"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">
            {token.name || shortenAddress(token.address)}
          </span>
          {token.symbol && (
            <span className="shrink-0 font-mono text-[11px] uppercase text-ink-dim">
              {token.symbol}
            </span>
          )}
          {token.alreadyOnTorch && (
            <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
              Updating
            </span>
          )}
        </div>
        <p className="truncate font-mono text-[11px] text-ink-dim">
          {shortenAddress(token.address)}
        </p>
      </div>
      {onChange && (
        <button
          onClick={onChange}
          className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-dim transition hover:bg-bg-soft hover:text-ink"
        >
          Change
        </button>
      )}
    </div>
  );
}

function TokenAvatar({
  imageUrl,
  seed,
  className = "",
}: {
  imageUrl: string | null;
  seed: string;
  className?: string;
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        className={`shrink-0 rounded-full bg-bg-soft object-cover ${className}`}
      />
    );
  }
  const monogram = seed.slice(0, 2).toUpperCase();
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-brand-soft font-mono text-xs font-bold text-brand ${className}`}
    >
      {monogram}
    </span>
  );
}

/* --- Icons ---------------------------------------------------------------- */

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m4 10.5 4 4 8-9" />
    </svg>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4M6 10l6-6 6 6" />
      <path d="M4 20h16" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
