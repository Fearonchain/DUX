import { API_BASE } from "../lib/config";
import { FlameMark } from "../components/Logo";

const GITHUB_URL = "https://github.com/thebagworker/DUX";

const th = "border-b border-line px-2.5 py-2 text-left font-semibold text-ink-dim";
const td = "border-b border-line px-2.5 py-2 align-top";
const code = "font-mono text-[13px]";
const pre =
  "my-2 block overflow-x-auto rounded-lg border border-line bg-bg-soft px-3.5 py-2.5 font-mono text-[13px] whitespace-pre";
const h2 = "mt-9 border-b border-line pb-2 text-xl font-semibold";

const EXAMPLE_MINT = "So11111111111111111111111111111111111111112";

export default function Docs() {
  return (
    <div className="pb-10">
      <div className="flex items-center gap-2 text-brand">
        <FlameMark className="h-5 w-5" />
        <span className="font-display text-xs font-bold uppercase tracking-[0.2em]">
          Free &amp; open API
        </span>
      </div>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">API Documentation</h1>
      <p className="mt-2 max-w-2xl text-ink-dim">
        The same enhanced token info Dexscreener charges <span className="font-semibold text-ink">$299</span> for — as a
        free, open, key-less API. Responses are compatible with the Dexscreener token-profiles schema,
        so integrators reuse their existing parser and just add the base URL.
      </p>

      {/* Key facts */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Fact label="Auth" value="None — no API keys" />
        <Fact label="CORS" value="Access-Control-Allow-Origin: *" />
        <Fact label="Chains" value="Solana + major EVM" />
      </div>

      <p className="mt-6 text-ink-dim">
        Base URL: <code className={code}>{API_BASE}</code>
      </p>
      <p className="mt-2 text-sm text-ink-dim">
        Machine-readable spec:{" "}
        <a href="/openapi.json" className="font-semibold text-brand hover:underline">
          openapi.json
        </a>{" "}
        · Integration guide:{" "}
        <a
          href={`${GITHUB_URL}/blob/main/INTEGRATION.md`}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-brand hover:underline"
        >
          INTEGRATION.md
        </a>
      </p>

      {/* Quick start */}
      <h2 className={h2}>Quick start</h2>
      <p className="mt-2 text-ink-dim">Fetch a single token profile — no key, works from the browser:</p>
      <pre className={pre}>{`curl ${API_BASE}/token-profiles/solana/${EXAMPLE_MINT}
# EVM tokens use the chain slug + 0x contract address:
curl ${API_BASE}/token-profiles/base/0x4200000000000000000000000000000000000006`}</pre>

      {/* Endpoints */}
      <h2 className={h2}>Endpoints</h2>
      <div className="my-3 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={th}>Method</th>
              <th className={th}>Path</th>
              <th className={th}>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={td}>GET</td>
              <td className={`${td} ${code} whitespace-nowrap`}>/token-profiles/latest/v1</td>
              <td className={td}>Newest token profiles (max 50)</td>
            </tr>
            <tr>
              <td className={td}>GET</td>
              <td className={`${td} ${code} whitespace-nowrap`}>/token-profiles/recent-updates/v1</td>
              <td className={td}>Most recently updated profiles (max 50)</td>
            </tr>
            <tr>
              <td className={td}>GET</td>
              <td className={`${td} ${code} whitespace-nowrap`}>/token-profiles/{"{chainId}"}/{"{tokenAddress}"}</td>
              <td className={td}>Single profile by chain + address (404 if none)</td>
            </tr>
            <tr>
              <td className={td}>GET</td>
              <td className={`${td} ${code} whitespace-nowrap`}>/token-profiles/images/{"{id}"}</td>
              <td className={td}>Banner/icon image (JPEG/PNG, cached immutable)</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Response schema */}
      <h2 className={h2}>Response schema</h2>
      <p className="mt-2 text-ink-dim">
        A single profile. List endpoints return an array of these objects.
      </p>
      <pre className={pre}>{`{
  "url": "https://<frontend>/token/<chainId>/<tokenAddress>",
  "chainId": "solana",
  "tokenAddress": "${EXAMPLE_MINT}",
  "icon": "<base>/token-profiles/images/<uuid>",   // or null
  "header": "<base>/token-profiles/images/<uuid>", // or null
  "description": "…",                               // or null, <= 600 chars
  "links": [
    { "type": "website", "url": "https://example.com" },
    { "type": "twitter", "url": "https://x.com/example" }
  ],
  "updatedAt": "2026-07-19T12:00:00.000Z"
}`}</pre>
      <p className="mt-2 text-sm text-ink-dim">
        Field names match Dexscreener (<code className={code}>url, chainId, tokenAddress, icon, header,
        description, links[].type/label/url</code>), plus <code className={code}>updatedAt</code> for
        merge/conflict resolution. <code className={code}>links[].url</code> is always an{" "}
        <code className={code}>https://</code> URL on a public host.
      </p>

      {/* Status codes */}
      <h2 className={h2}>Status codes &amp; errors</h2>
      <div className="my-3 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={th}>Code</th>
              <th className={th}>Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={`${td} ${code}`}>200</td>
              <td className={td}>Success. JSON body (profile or array).</td>
            </tr>
            <tr>
              <td className={`${td} ${code}`}>404</td>
              <td className={td}>
                No profile/image. Body: <code className={code}>{`{ "error": "not found" }`}</code>. Treat as
                "no enhanced info" and render your default layout.
              </td>
            </tr>
            <tr>
              <td className={`${td} ${code}`}>405</td>
              <td className={td}>Method not allowed (read endpoints are GET-only).</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Caching */}
      <h2 className={h2}>Caching &amp; headers</h2>
      <ul className="mt-2 space-y-1.5 text-sm text-ink-dim">
        <li>
          Read endpoints: <code className={code}>Cache-Control: public, max-age=15, s-maxage=15</code>.
        </li>
        <li>
          Images: <code className={code}>Cache-Control: public, max-age=31536000, immutable</code> +{" "}
          <code className={code}>X-Content-Type-Options: nosniff</code>.
        </li>
        <li>
          All endpoints: <code className={code}>Access-Control-Allow-Origin: *</code> — safe to call directly
          from a browser.
        </li>
      </ul>

      {/* Integration */}
      <h2 className={h2}>Integration (Axiom / Padre / GMGN-style frontends)</h2>
      <p className="mt-2 text-ink-dim">
        Query Dexscreener first, then fall back to Torch when no profile exists — or merge both using{" "}
        <code className={code}>updatedAt</code>:
      </p>
      <pre className={pre}>{`const res = await fetch(
  \`${API_BASE}/token-profiles/\${chainId}/\${tokenAddress}\`
);
if (res.ok) {
  const profile = await res.json();
  // identical field layout to Dexscreener token-profiles
  render(profile.header, profile.description, profile.links);
}`}</pre>
      <p className="mt-2 text-ink-dim">Bulk sync — poll every ~30s and upsert by <code className={code}>tokenAddress</code>:</p>
      <pre className={pre}>{`curl ${API_BASE}/token-profiles/recent-updates/v1`}</pre>

      {/* Verification */}
      <h2 className={h2}>Verification (how write access works)</h2>
      <div className="my-3 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={th}>Step</th>
              <th className={th}>What happens</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={`${td} ${code} whitespace-nowrap`}>POST /auth/nonce</td>
              <td className={td}>Server creates a single-use nonce (valid 5 min) and the message to sign.</td>
            </tr>
            <tr>
              <td className={td}>Wallet signature</td>
              <td className={td}>Phantom/Solflare signs the message (no transaction, free).</td>
            </tr>
            <tr>
              <td className={`${td} ${code} whitespace-nowrap`}>POST /auth/verify</td>
              <td className={td}>
                Ed25519 check + on-chain check: Metaplex update authority, mint authority, pump.fun creator,
                or ≥3% of supply. On success: a JWT (30 min) scoped to exactly this token.
              </td>
            </tr>
            <tr>
              <td className={`${td} ${code} whitespace-nowrap`}>PUT /profile</td>
              <td className={td}>
                Multipart update: banner (→1500×500 JPEG, re-encoded, metadata stripped), description, links
                (https only). The <code className={code}>icon</code> is server-derived from on-chain metadata,
                never user-editable.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Rate limits */}
      <h2 className={h2}>Rate limits</h2>
      <p className="mt-2 text-ink-dim">
        Read endpoints are cached (15s) and unmetered for normal use. Write/auth endpoints: ~10–20
        requests/min per IP.
      </p>

      <div className="mt-10 rounded-2xl border border-line bg-bg-soft p-5 text-sm text-ink-dim">
        Torch is free and open source.{" "}
        <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="font-semibold text-brand hover:underline">
          Star it on GitHub
        </a>{" "}
        or self-host your own instance — see{" "}
        <a
          href={`${GITHUB_URL}/blob/main/DEPLOYMENT.md`}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-brand hover:underline"
        >
          DEPLOYMENT.md
        </a>
        .
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-card px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-dim">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}
