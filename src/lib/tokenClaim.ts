/**
 * Shared logic for claiming and editing a token's enhanced info.
 *
 * "Claiming" a token on Torch is a three-part flow:
 *
 *   1. Prove you control it — connect the token's authority wallet (dev wallet /
 *      pump.fun creator) or a wallet holding ≥3% of supply, then sign a message.
 *      No transaction, no cost. See {@link verifyTokenOwnership}.
 *   2. Send your info — banner, description and links. See {@link saveTokenProfile}.
 *   3. It's live instantly via the public API.
 *
 * Both the classic token page and the guided "Add your token" wizard drive the
 * exact same backend calls, so that logic lives here once instead of being
 * duplicated across screens.
 */

import { API_BASE } from "./config";
import { DEFAULT_CHAIN_ID } from "./chains";

export { isValidEvmAddress, isValidSolanaAddress } from "./chains";

/** What the backend hands back once ownership is proven. */
export interface OwnershipVerification {
  /** Short-lived bearer token that authorizes profile edits for this token. */
  editToken: string;
  /** How the wallet qualified, e.g. "authority" or "holder". */
  role: string;
  /** Human-readable detail about the successful verification. */
  detail: string;
}

/** A single profile link (website, X, etc.) sent to the backend. */
export interface TokenProfileLink {
  type: string;
  url: string;
}

/** The editable fields of a token's enhanced-info profile. */
export interface TokenProfileEdits {
  description: string | null;
  links: TokenProfileLink[];
  /** Optional pre-processed banner (already cropped to 1500×500 JPEG). */
  bannerBlob?: Blob | null;
}

/**
 * Prove control of a token by signing a server-issued nonce, and receive a
 * short-lived edit token in return. The wallet only signs a message — Torch
 * never asks for, builds, or sends a transaction.
 */
export async function verifyTokenOwnership(params: {
  chainId?: string;
  wallet: string;
  tokenAddress: string;
  /**
   * Sign a plain-text message and return a wire-ready signature. The wallet
   * layer encodes it per chain (base58 for Solana, `0x`-hex for EVM), so this
   * function forwards the signature to the backend verbatim.
   */
  signMessage: (message: string) => Promise<string>;
}): Promise<OwnershipVerification> {
  const { wallet, tokenAddress, signMessage } = params;
  const chainId = params.chainId ?? DEFAULT_CHAIN_ID;

  const nonceRes = await fetch(`${API_BASE}/auth/nonce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chainId, wallet, tokenAddress }),
  });
  if (!nonceRes.ok) {
    const body = await nonceRes.json().catch(() => ({}));
    throw new Error(body.error ?? "nonce request failed");
  }
  const { nonce, message } = await nonceRes.json();

  const signature = await signMessage(message);

  const verifyRes = await fetch(`${API_BASE}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chainId,
      wallet,
      tokenAddress,
      nonce,
      signature,
    }),
  });
  const data = await verifyRes.json();
  if (!verifyRes.ok) throw new Error(data.detail ?? data.error ?? "verification failed");

  return { editToken: data.editToken, role: data.role, detail: data.detail };
}

/**
 * Persist a token's enhanced info. Requires the edit token returned by
 * {@link verifyTokenOwnership}. Changes go live immediately via the public API.
 */
export async function saveTokenProfile(
  editToken: string,
  edits: TokenProfileEdits
): Promise<void> {
  const form = new FormData();
  form.set(
    "payload",
    JSON.stringify({ description: edits.description, links: edits.links })
  );
  if (edits.bannerBlob) {
    form.set("banner", new File([edits.bannerBlob], "banner.jpg", { type: "image/jpeg" }));
  }

  const res = await fetch(`${API_BASE}/profile`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${editToken}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail ?? data.error ?? "save failed");
}

/**
 * Convert any browser-readable image into a clean 1500×500 JPEG before upload
 * (center cover-crop). This makes huge photos, webp, etc. just work; the server
 * still re-validates and re-encodes it.
 */
export async function prepareBannerImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  let source: CanvasImageSource;
  let sourceWidth: number;
  let sourceHeight: number;
  if (bitmap) {
    source = bitmap;
    sourceWidth = bitmap.width;
    sourceHeight = bitmap.height;
  } else {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not read this image file"));
    });
    source = img;
    sourceWidth = img.naturalWidth;
    sourceHeight = img.naturalHeight;
  }

  const TARGET_WIDTH = 1500;
  const TARGET_HEIGHT = 500;
  const scale = Math.max(TARGET_WIDTH / sourceWidth, TARGET_HEIGHT / sourceHeight);
  const cropWidth = TARGET_WIDTH / scale;
  const cropHeight = TARGET_HEIGHT / scale;
  const cropX = (sourceWidth - cropWidth) / 2;
  const cropY = (sourceHeight - cropHeight) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = TARGET_WIDTH;
  canvas.height = TARGET_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process the image");
  ctx.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.86)
  );
  if (!blob) throw new Error("Could not process the image");
  return blob;
}
