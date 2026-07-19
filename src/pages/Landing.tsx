import { useState } from "react";
import { useNavigate } from "react-router-dom";
import RecentTokensMarquee from "../components/RecentTokensMarquee";

export default function Landing() {
  const navigate = useNavigate();
  const [ca, setCa] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function go() {
    const addr = ca.trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)) {
      setErr("That does not look like a valid Solana address.");
      return;
    }
    navigate(`/token/${addr}`);
  }

  return (
    <div className="py-10 text-center">
      <h1 className="mb-4 text-4xl font-bold leading-tight tracking-tight md:text-5xl">
        Enhanced Token Info.
        <br />
        <span className="text-accent">Free. Forever.</span>
      </h1>
      <p className="mx-auto mb-8 max-w-xl text-[17px] text-ink-dim">
        Banner, description and links for your Solana token. Verified on-chain, without
        paying&nbsp;$299. Dev wallet or ≥3% holder is enough. Open API for any trading platform.
      </p>

      <div className="mx-auto flex max-w-xl flex-col gap-2.5 sm:flex-row">
        <input
          value={ca}
          onChange={(e) => {
            setCa(e.target.value);
            setErr(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && go()}
          placeholder="Enter token address (CA)…"
          spellCheck={false}
          autoFocus
          className="flex-1 rounded-xl border border-line bg-bg-soft px-4 py-3.5 font-mono text-[15px] outline-none focus:border-accent"
        />
        <button
          onClick={go}
          className="rounded-xl bg-accent px-6 py-3.5 font-bold text-bg transition hover:bg-accent-dark"
        >
          Open token
        </button>
      </div>
      {err && <p className="mt-3 text-danger">{err}</p>}

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
    </div>
  );
}
