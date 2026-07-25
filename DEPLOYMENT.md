# Deployment

Torch is a Vite/React frontend plus three Supabase Edge Functions and a Postgres schema. The frontend runs on any static host (Vercel, Netlify, Cloudflare Pages, or any platform that builds Vite apps); the backend runs on any Supabase project (free tier is fine).

## Prerequisites

- A [Supabase](https://supabase.com) project
- A Solana RPC endpoint. A free [Helius](https://helius.dev) key is recommended; the public RPC works but is heavily rate-limited.
- Node 20+ if you build the frontend yourself

## 1. Database

Open the Supabase **SQL Editor** and run the contents of [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql). This creates `token_profiles`, `images`, `auth_nonces` and `audit_log`, with Row Level Security enabled (all access goes through the edge functions).

## 2. Edge function secrets

In Supabase, under **Edge Functions -> Secrets**, set:

| Secret | Value |
| ------ | ----- |
| `AUTH_SECRET` | >= 32 random characters (`openssl rand -hex 32`) |
| `SOLANA_RPC_URL` | e.g. `https://mainnet.helius-rpc.com/?api-key=<key>` |
| `FRONTEND_URL` | public URL of your frontend (used in API responses) |
| `HOLDER_THRESHOLD_PERCENT` | optional, default `3` |
| `ETHEREUM_RPC_URL` | optional EVM RPC override; a keyless public default is used if unset |
| `BASE_RPC_URL` | optional EVM RPC override |
| `ARBITRUM_RPC_URL` | optional EVM RPC override |
| `BSC_RPC_URL` | optional EVM RPC override |
| `POLYGON_RPC_URL` | optional EVM RPC override |
| `OPTIMISM_RPC_URL` | optional EVM RPC override |
| `AVALANCHE_RPC_URL` | optional EVM RPC override |

## 3. Deploy the functions

```bash
npx supabase login
npx supabase functions deploy auth profile token-profiles --project-ref <your-ref>
```

The functions are public JSON APIs. `verify_jwt = false` is preconfigured in [`supabase/config.toml`](./supabase/config.toml); authentication happens inside the functions via wallet signatures. Verify the deploy:

```
GET https://<your-ref>.supabase.co/functions/v1/token-profiles/latest/v1   ->  []
```

## 4. Frontend

Set the env vars (in your host's dashboard or a local `.env`, see `.env.example`):

```
VITE_API_BASE=https://<your-ref>.supabase.co/functions/v1
VITE_REOWN_PROJECT_ID=         # Reown project id (unified EVM + Solana wallet modal)
VITE_SOLANA_RPC_URL=           # optional, Solana wallet-adapter only
```

Then build and deploy:

```bash
npm install
npm run build     # output in dist/
```

## 5. Smoke test

Open the site, enter a mint your wallet qualifies for (update authority, pump.fun creator, or >= 3% holder), verify with Phantom (message signature, no transaction), upload a banner, save. Then confirm the public API returns your data:

```
GET https://<your-ref>.supabase.co/functions/v1/token-profiles/solana/<mint>
```

## Local development

```bash
npm install
npm test                          # unit tests (Node)
# run the functions locally against any Postgres:
DATABASE_URL=postgres://... AUTH_SECRET=... SOLANA_RPC_URL=... \
deno run --allow-net --allow-env --allow-read \
  --import-map supabase/functions/import_map.json scripts/serve-functions.ts
node scripts/e2e.mjs              # end-to-end suite (starts a mock RPC; the local runner
                                  # needs UNSAFE_ALLOW_HTTP_METADATA=1, test-only, never in prod)
npm run dev                       # frontend on :5173, expects functions on :8787
```
