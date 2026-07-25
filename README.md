# Torch 🔥

**Free token info. Burn the paywall.**

**Live:** [torch-sable.vercel.app](https://torch-sable.vercel.app)

Torch is the free, open-source alternative to Dexscreener's **$299** paywall for **Enhanced Token Info** on Solana. Token teams and major holders can publish a banner, description and verified links for their token, authorized purely on-chain, at no cost. The data is served through an open, Dexscreener-compatible API that any trading platform can integrate.

- **Frontend:** Vite + React + TypeScript + Tailwind
- **Backend:** Supabase Edge Functions (Deno) + Postgres. No dedicated server needed.
- **Wallets:** Phantom / Solflare (direct, dependency-free integration)

**Write access is verified on-chain.** A wallet can edit a token's info if it is the Metaplex metadata **update authority**, the **mint authority**, the **pump.fun creator**, or holds **>= 3%** of the supply. Verification is a free message signature (no transaction), checked server-side against Solana RPC.

Deployment: see [`DEPLOYMENT.md`](./DEPLOYMENT.md).
Integrators (trading platforms): see [`INTEGRATION.md`](./INTEGRATION.md).

## How it works:

1. A user enters a token mint address and connects their wallet.
2. The server issues a single-use nonce; the wallet signs a plain message (SIWS-style, never a transaction).
3. The server verifies the ed25519 signature, then checks on-chain qualification via RPC.
4. On success it issues a 30-minute JWT scoped to exactly that token.
5. Banner uploads are fully decoded and re-encoded server-side (metadata stripped), links are validated, and everything is served instantly through the public API.

## Public API: what trading platforms integrate

Base URL: `https://<project-ref>.supabase.co/functions/v1`. CORS `*`, no API key, no auth.

A terminal (Axiom / Padre / GMGN) needs exactly two endpoints:

1. When rendering a token page, fetch `GET /token-profiles/solana/{tokenAddress}` and render `header` (banner), `description` and `links` next to your existing token info. `icon` is always `null` (schema compatibility only) — keep your own token-icon source. 404 means no profile, show your default layout.

2. Optional: poll `GET /token-profiles/recent-updates/v1` every 15-30 s and upsert by `tokenAddress` (responses are CDN-cached 15 s). `updatedAt` tells you what changed.

Also available: `GET /token-profiles/latest/v1` and `GET /token-profiles/images/{id}` (banner JPEG). Field names/layout match the Dexscreener token-profiles schema, so an existing Dexscreener parser works as-is. See `INTEGRATION.md`.

## Security model:

- Single-use nonces (5 min TTL), marked used before signature verification: replay- and race-safe.
- The signed message is reconstructed server-side; the client cannot alter wallet, token, nonce or domain.
- Signatures are plain messages, never transactions; they cannot move funds or grant approvals.
- JWTs are HS256, 30-minute TTL, scoped to a single token mint.
- Every banner upload is fully decoded and re-encoded with a pure-JS pipeline (jpeg-js + upng-js, no native code). EXIF/metadata and polyglot payloads are destroyed; output is a fixed 1500x500 JPEG.
- Links must be public `https://` URLs (one website + one X/Twitter). `javascript:`, `data:`, `http:`, credentialed URLs, raw IPs and private hosts are rejected.
- Image responses ship `X-Content-Type-Options: nosniff` and a deny-all CSP.
- Per-IP rate limits on auth and write endpoints.
- Every change is written to an append-only audit log with wallet and role.
- Row Level Security is enabled on all tables; PostgREST cannot touch them directly.

## Trademark / non-affiliation

Torch is an independent community project. It is **not affiliated with, endorsed by, or connected to DEX Screener, Inc.** ("Dexscreener"). "Dexscreener" and related marks are the property of their respective owners; they are referenced only to describe API compatibility (nominative use). The site displays a permanent non-affiliation notice. If you fork or deploy this project, keep these notices intact.

## License

MIT, see [`LICENSE`](./LICENSE).
