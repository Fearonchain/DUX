# Integration Guide, for trading platforms (Axiom / Padre / GMGN-style)

Torch exposes token profiles in the **same schema as Dexscreener's token-profiles API**. If you already render Dexscreener enhanced token info, integrating this source is a base-URL change plus a fallback.

## Endpoints

Base URL: `https://<project-ref>.supabase.co/functions/v1`

```
GET <base>/token-profiles/latest/v1
GET <base>/token-profiles/recent-updates/v1
GET <base>/token-profiles/solana/{tokenAddress}
GET <base>/token-profiles/images/{id}
```

- No API key, no auth.
- CORS: `Access-Control-Allow-Origin: *` (browser-side fetch works).
- Read endpoints send `Cache-Control: public, max-age=15`.

Machine-readable spec: [`/openapi.json`](https://torch-sable.vercel.app/openapi.json) (OpenAPI 3.1).

## Quick start

```bash
# single token profile (404 if none)
curl <base>/token-profiles/solana/So11111111111111111111111111111111111111112

# recently updated profiles (poll ~30s, upsert by tokenAddress)
curl <base>/token-profiles/recent-updates/v1
```

## Response schema

```json
{
  "url": "https://<frontend>/token/<tokenAddress>",
  "chainId": "solana",
  "tokenAddress": "So11111111111111111111111111111111111111112",
  "icon": "<base>/token-profiles/images/<uuid>",
  "header": "<base>/token-profiles/images/<uuid>",
  "description": "…",
  "links": [
    { "type": "website", "url": "https://example.com" },
    { "type": "twitter", "url": "https://x.com/example" }
  ],
  "updatedAt": "2026-07-19T12:00:00.000Z"
}
```

Identical field names to Dexscreener (`url`, `chainId`, `tokenAddress`, `icon`, `header`, `description`, `links[].type/label/url`), plus `updatedAt` for merge conflict resolution.

## Recommended pattern: fallback / merge

```ts
async function getTokenProfile(mint: string) {
  const ds = await getDexscreenerProfile(mint); // your existing source
  if (ds) return ds;
  const res = await fetch(`<base>/token-profiles/solana/${mint}`);
  if (res.ok) return await res.json(); // same shape, reuse your parser
  return null;
}
```

## Trust & content-safety guarantees

- Every profile was authorized by a wallet that **proved on-chain** it is the token's update/mint authority, pump.fun creator, or holds ≥ 3% of supply (ed25519 message signature + RPC check, single-use nonce).
- `links[].url` is guaranteed `https://` on a public host, never `javascript:`, `data:`, raw IPs or private hostnames.
- `header` banners are always server-re-encoded (fully decoded and re-encoded to a fixed 1500×500 JPEG), metadata stripped, served with `nosniff` + deny-all CSP.
- The token `icon` is **never** user-editable. The server auto-populates it from the token's on-chain Metaplex metadata (fetched with SSRF hardening, fully re-encoded to a 256x256 PNG). It may be `null` when the metadata has no reachable image; fall back to your existing icon source in that case.
- `description` ≤ 600 chars plain text. Escape it in your renderer as you would any user content.
- An append-only `audit_log` records which wallet made every change.

## Bulk sync

Poll `/token-profiles/recent-updates/v1` (e.g. every 30 s) and upsert by `tokenAddress`, the same pattern you already use with Dexscreener's endpoints.
