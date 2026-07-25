import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import RecentTokensMarquee from "../components/RecentTokensMarquee";
import ContractAddress from "../components/ContractAddress";
import { FlameMark } from "../components/Logo";
import { TOKEN_CONTRACT_ADDRESS } from "../lib/config";
import { DEFAULT_CHAIN_ID, isValidEvmAddress, isValidSolanaAddress } from "../lib/chains";
import { resolveTokenAcrossChains } from "../lib/market";

export default function Landing() {
  const navigate = useNavigate();
  const [ca, setCa] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  async function go() {
    const addr = ca.trim();
    // Solana mints go straight through; EVM (0x…) addresses can live on many
    // chains, so ask the market resolver which chain actually has the token.
    if (isValidSolanaAddress(addr)) {
      navigate(`/token/${DEFAULT_CHAIN_ID}/${addr}`);
      return;
    }
    if (isValidEvmAddress(addr)) {
      setResolving(true);
      setErr(null);
      const { chainId } = await resolveTokenAcrossChains(addr);
      setResolving(false);
      // The resolver defaults to Solana when it finds no market; for a 0x
      // address fall back to Ethereum so the page at least loads the right type.
      const target = chainId === DEFAULT_CHAIN_ID ? "ethereum" : chainId;
      navigate(`/token/${target}/${addr}`);
      return;
    }
    setErr("That does not look like a valid Solana or EVM token address.");
  }

  return (
    <div className="py-10 text-center sm:py-14">
      <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-bg-soft px-3.5 py-1.5 text-xs font-semibold text-ink-dim">
        <FlameMark className="h-3.5 w-3.5 text-brand" />
        Free &amp; open-source · No $299 paywall
      </span>
      <h1 className="mb-4 text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl">
        Enhanced token info.
        <br />
        <span className="bg-gradient-to-r from-brand to-brand-strong bg-clip-text text-transparent">
          Free. Forever.
        </span>
      </h1>
      <p className="mx-auto mb-8 max-w-xl text-[17px] leading-relaxed text-ink-dim">
        Banner, description and links for your Solana token — verified on-chain, without paying{" "}
        <span className="font-semibold text-ink line-through decoration-brand/60">$299</span>. Dev
        wallet or ≥3% holder is enough. Open API for any trading platform.
      </p>

      <div className="mx-auto flex max-w-xl flex-col gap-2.5 sm:flex-row">
        <input
          value={ca}
          onChange={(e) => {
            setCa(e.target.value);
            setErr(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && go()}
          placeholder="Enter token address (Solana or EVM)…"
          spellCheck={false}
          autoFocus
          className="flex-1 rounded-xl border border-line bg-bg-soft px-4 py-3.5 font-mono text-[15px] outline-none focus:border-accent"
        />
        <button
          onClick={go}
          disabled={resolving}
          className="rounded-xl bg-brand-strong px-6 py-3.5 font-bold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {resolving ? "Resolving…" : "Open token"}
        </button>
      </div>
      {err && <p className="mt-3 text-danger">{err}</p>}

      {TOKEN_CONTRACT_ADDRESS && (
        <div className="mt-6 flex justify-center">
          <ContractAddress full className="shadow-sm" />
        </div>
      )}

      <div className="mt-10">
        <RecentTokensMarquee />
      </div>

      <div className="mt-14 grid gap-4 text-left sm:grid-cols-3">
        {[
          { n: 1, t: "Enter the CA", d: "Paste your token\u2019s mint address." },
          {
            n: 2,
            t: "Verify with Phantom",
            d: "One free signature (no transaction). We check on-chain: update authority, pump.fun creator, or ≥3% of supply.",
          },
          {
            n: 3,
            t: "Update your info",
            d: "Banner, description, links. Live instantly via the open API.",
          },
        ].map((s) => (
          <div key={s.n} className="rounded-xl border border-line bg-card p-5">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm font-bold text-bg">
              {s.n}
            </span>
            <h3 className="mb-1.5 mt-2.5 font-semibold">{s.t}</h3>
            <p className="text-sm text-ink-dim">{s.d}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-center">
        <Link
          to="/add"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-strong px-6 py-3 font-bold text-white transition hover:brightness-110"
        >
          <FlameMark className="h-4 w-4" />
          Add your token now
        </Link>
      </div>

      {/* Burn the paywall: why Torch exists */}
      <div className="mt-16">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 text-brand">
            <FlameMark className="h-5 w-5" />
            <span className="font-display text-xs font-bold uppercase tracking-[0.2em]">
              Burn the paywall
            </span>
            <FlameMark className="h-5 w-5" />
          </span>
          <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-bold tracking-tight md:text-4xl">
            Token info should be free.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-ink-dim">
            Dexscreener charges <span className="font-semibold text-ink">$299</span> to update a
            banner, description and links. Torch does the exact same thing — verified on-chain — for{" "}
            <span className="font-semibold text-brand">$0</span>.
          </p>
        </div>

        <div className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-card p-6 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-dim">The old way</p>
            <p className="mt-2 font-display text-3xl font-bold text-ink-dim line-through decoration-danger/50">
              $299
            </p>
            <ul className="mt-4 space-y-2.5 text-sm text-ink-dim">
              <li className="flex items-start gap-2">
                <XIcon /> Pay-to-update your own token info
              </li>
              <li className="flex items-start gap-2">
                <XIcon /> Closed, proprietary platform
              </li>
              <li className="flex items-start gap-2">
                <XIcon /> Gatekept API access
              </li>
            </ul>
          </div>
          <div className="relative rounded-2xl border-2 border-brand bg-brand-soft/40 p-6 text-left">
            <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-brand-strong px-2.5 py-0.5 text-[11px] font-bold text-white">
              <FlameMark className="h-3 w-3" /> Torch
            </span>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">The Torch way</p>
            <p className="mt-2 font-display text-3xl font-bold text-brand">$0</p>
            <ul className="mt-4 space-y-2.5 text-sm text-ink">
              <li className="flex items-start gap-2">
                <CheckIcon /> Free forever — no fees, ever
              </li>
              <li className="flex items-start gap-2">
                <CheckIcon /> Open-source &amp; self-hostable
              </li>
              <li className="flex items-start gap-2">
                <CheckIcon /> Open public API, no keys
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-brand" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m4 10.5 4 4 8-9" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-ink-dim/70" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true">
      <path d="m6 6 8 8M14 6l-8 8" />
    </svg>
  );
}
