/**
 * Dynamic Open Graph image for token share cards.
 * Torch-branded (banner + avatar + stats + flame mark) — not Dexscreener's card.
 *
 *   GET /api/og?chainId=solana&address=<mint>
 *
 * Uses the Node serverless (req, res) signature — Web Response handlers hang
 * under @vercel/node on this Vite project.
 */

import React from "react";
import { ImageResponse } from "@vercel/og";

const DEX_SLUG = {
  solana: "solana",
  ethereum: "ethereum",
  base: "base",
  arbitrum: "arbitrum",
  bsc: "bsc",
  polygon: "polygon",
  optimism: "optimism",
  avalanche: "avalanche",
};

const CHAIN_LABEL = {
  solana: "SOL",
  ethereum: "ETH",
  base: "BASE",
  arbitrum: "ARB",
  bsc: "BNB",
  polygon: "POL",
  optimism: "OP",
  avalanche: "AVAX",
};

function formatUsd(n) {
  if (n === undefined || n === null || !Number.isFinite(n)) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.0001) return `$${n.toFixed(4)}`;
  return `$${n.toPrecision(3)}`;
}

function formatPct(n) {
  if (n === undefined || n === null || !Number.isFinite(n)) {
    return { text: "", color: "#94a3b8" };
  }
  const sign = n > 0 ? "+" : "";
  return {
    text: `${sign}${n.toFixed(2)}%`,
    color: n > 0 ? "#22c55e" : n < 0 ? "#ef4444" : "#94a3b8",
  };
}

function deepestPair(pairs, dexSlug) {
  const onChain = pairs.filter((p) => p?.chainId === dexSlug);
  if (onChain.length === 0) return null;
  return onChain.reduce((a, b) =>
    Number(b?.liquidity?.usd ?? 0) > Number(a?.liquidity?.usd ?? 0) ? b : a
  );
}

/**
 * Dexscreener often serves animated GIF headers (`format=auto`). Satori can't
 * decode those, so fetch + rasterize to a JPEG data URI via sharp.
 */
async function loadRasterDataUrl(url) {
  if (typeof url !== "string" || !url) return null;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 TorchOG/1.0",
        Referer: "https://dexscreener.com/",
      },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 32) return null;
    const type = (res.headers.get("content-type") || "").toLowerCase();
    const needsConvert =
      type.includes("gif") ||
      type.includes("webp") ||
      type.includes("avif") ||
      buf[0] === 0x47; // 'G' — GIF magic
    if (needsConvert) {
      const sharp = (await import("sharp")).default;
      const jpeg = await sharp(buf, { animated: false })
        .resize({ width: 1200, height: 400, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
    }
    // Still downscale large JPEG/PNG avatars/headers for a smaller final card.
    try {
      const sharp = (await import("sharp")).default;
      const jpeg = await sharp(buf)
        .resize({ width: 1200, height: 400, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
    } catch {
      const mime = type.split(";")[0] || "image/jpeg";
      return `data:${mime};base64,${buf.toString("base64")}`;
    }
  } catch {
    return null;
  }
}

async function fetchToken(chainId, address) {
  const dexSlug = DEX_SLUG[chainId];
  if (!dexSlug) return null;
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  const body = await res.json();
  const best = deepestPair(Array.isArray(body?.pairs) ? body.pairs : [], dexSlug);
  if (!best) return null;
  const info = best.info ?? {};
  const base = best.baseToken ?? {};
  const [imageUrl, headerUrl] = await Promise.all([
    loadRasterDataUrl(info.imageUrl),
    loadRasterDataUrl(info.header),
  ]);
  return {
    name: base.name || "Unknown",
    symbol: base.symbol || "",
    imageUrl,
    headerUrl,
    marketCap: Number(best.marketCap ?? best.fdv),
    volume24h: Number(best.volume?.h24),
    liquidity: Number(best.liquidity?.usd),
    change24h: Number(best.priceChange?.h24),
  };
}

function Stat({ label, value, sub, subColor }) {
  return React.createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 6, minWidth: 140 } },
    React.createElement(
      "div",
      { style: { fontSize: 18, fontWeight: 700, letterSpacing: "0.08em", color: "#64748b" } },
      label
    ),
    React.createElement(
      "div",
      { style: { display: "flex", alignItems: "baseline", gap: 10 } },
      React.createElement(
        "div",
        { style: { fontSize: 36, fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.02em" } },
        value
      ),
      sub
        ? React.createElement(
            "div",
            { style: { fontSize: 22, fontWeight: 700, color: subColor || "#94a3b8" } },
            sub
          )
        : null
    )
  );
}

function buildTree({ name, symbol, chainLabel, mcap, vol, liq, pct, torchIcon, avatar, header }) {
  const bannerChildren = [];
  if (header) {
    bannerChildren.push(
      React.createElement("img", {
        src: header,
        alt: "",
        width: 1200,
        height: 360,
        style: { position: "absolute", width: "100%", height: "100%", objectFit: "cover" },
      })
    );
  }
  bannerChildren.push(
    React.createElement("div", {
      style: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 120,
        background: "linear-gradient(to top, #0b0f14, transparent)",
        display: "flex",
      },
    })
  );
  bannerChildren.push(
    React.createElement(
      "div",
      {
        style: {
          position: "absolute",
          left: 48,
          bottom: 24,
          display: "flex",
          alignItems: "flex-end",
          gap: 14,
        },
      },
      React.createElement(
        "div",
        {
          style: {
            width: 112,
            height: 112,
            borderRadius: 999,
            overflow: "hidden",
            border: "4px solid #0b0f14",
            background: "#1e293b",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          },
        },
        avatar
          ? React.createElement("img", {
              src: avatar,
              alt: "",
              width: 112,
              height: 112,
              style: { width: "100%", height: "100%", objectFit: "cover" },
            })
          : React.createElement(
              "div",
              { style: { fontSize: 48, displayContent: "center", display: "flex" } },
              "?"
            )
      ),
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            background: "rgba(15, 23, 42, 0.85)",
            border: "1px solid rgba(148, 163, 184, 0.25)",
            borderRadius: 999,
            padding: "8px 14px",
            marginBottom: 8,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: "#e2e8f0",
          },
        },
        chainLabel
      )
    )
  );
  bannerChildren.push(
    React.createElement(
      "div",
      {
        style: {
          position: "absolute",
          right: 40,
          bottom: 28,
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "rgba(11, 15, 20, 0.72)",
          border: "1px solid rgba(109, 94, 252, 0.45)",
          borderRadius: 999,
          padding: "10px 18px 10px 10px",
        },
      },
      React.createElement("img", {
        src: torchIcon,
        alt: "Torch",
        width: 48,
        height: 48,
        style: { width: 48, height: 48, borderRadius: 12 },
      }),
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "#f8fafc",
            lineHeight: 1,
          },
        },
        "torch"
      )
    )
  );

  return React.createElement(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#0b0f14",
        color: "#f8fafc",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      },
    },
    React.createElement(
      "div",
      {
        style: {
          position: "relative",
          width: "100%",
          height: 360,
          display: "flex",
          overflow: "hidden",
          background: header
            ? "#0b0f14"
            : "linear-gradient(135deg, #1a1433 0%, #0b0f14 50%, #1e1b4b 100%)",
        },
      },
      ...bannerChildren
    ),
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          flex: 1,
          padding: "28px 48px 36px",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 32,
        },
      },
      React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 6, maxWidth: 420 } },
        React.createElement(
          "div",
          {
            style: {
              fontSize: 64,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              color: "#f8fafc",
            },
          },
          symbol || name
        ),
        symbol
          ? React.createElement(
              "div",
              { style: { fontSize: 28, color: "#94a3b8", fontWeight: 500 } },
              name
            )
          : null
      ),
      React.createElement(
        "div",
        { style: { display: "flex", gap: 48, alignItems: "flex-start" } },
        React.createElement(Stat, {
          label: "MCAP",
          value: mcap,
          sub: pct.text,
          subColor: pct.color,
        }),
        React.createElement(Stat, { label: "24H VOL", value: vol }),
        React.createElement(Stat, { label: "LIQUIDITY", value: liq })
      )
    )
  );
}

export default async function handler(req, res) {
  try {
    const host = req.headers["x-forwarded-host"] || req.headers.host || "torchdex.vercel.app";
    const proto = req.headers["x-forwarded-proto"] || "https";
    const origin = `${proto}://${host}`;
    const query = req.query || {};
    // Also parse from URL for edge-compat query shapes
    const url = new URL(req.url || "/", origin);
    const chainId = String(query.chainId || url.searchParams.get("chainId") || "solana").toLowerCase();
    const address = String(query.address || url.searchParams.get("address") || "");

    if (!address || !DEX_SLUG[chainId]) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "text/plain");
      res.end("Missing chainId or address");
      return;
    }

    const token = await fetchToken(chainId, address);
    const name = token?.name || address.slice(0, 6);
    const symbol = token?.symbol || "";
    const tree = buildTree({
      name,
      symbol,
      chainLabel: CHAIN_LABEL[chainId] || chainId.toUpperCase(),
      mcap: formatUsd(token?.marketCap),
      vol: formatUsd(token?.volume24h),
      liq: formatUsd(token?.liquidity),
      pct: formatPct(token?.change24h),
      torchIcon: `${origin}/torch-icon.png`,
      avatar: token?.imageUrl,
      header: token?.headerUrl,
    });

    const image = new ImageResponse(tree, { width: 1200, height: 630 });
    const png = Buffer.from(await image.arrayBuffer());
    // Twitter is picky: failed first fetches get cached, and ~1MB+ PNGs often
    // fail to render in the composer. Re-encode as a lean JPEG.
    const sharp = (await import("sharp")).default;
    const jpeg = await sharp(png).jpeg({ quality: 78, mozjpeg: true }).toBuffer();

    res.statusCode = 200;
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    res.setHeader("Content-Length", String(jpeg.length));
    res.end(jpeg);
  } catch (err) {
    const message = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(message);
  }
}
