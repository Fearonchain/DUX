import { useEffect, useMemo, useState } from "react";
import type { ChartTheme } from "./PriceChart";

interface EmbedChartDialogProps {
  address: string;
  symbol?: string;
  onClose: () => void;
}

/** Build the responsive, self-contained iframe snippet integrators paste in. */
function buildEmbedSnippet(embedUrl: string, symbol: string): string {
  return [
    '<style>#dux-embed{position:relative;width:100%;padding-bottom:125%;}',
    "@media(min-width:1400px){#dux-embed{padding-bottom:65%;}}",
    "#dux-embed iframe{position:absolute;width:100%;height:100%;top:0;left:0;border:0;}</style>",
    `<div id="dux-embed"><iframe src="${embedUrl}" title="DUX ${symbol} chart"></iframe></div>`,
  ].join("\n");
}

/**
 * Modal that hands token teams a copy-paste, responsive iframe snippet to embed
 * the DUX chart on their own site — mirroring the Dexscreener embed flow. The
 * snippet keeps a fixed aspect ratio and scales to the host container width, and
 * the chosen theme is baked into the embed URL.
 */
export default function EmbedChartDialog({ address, symbol = "token", onClose }: EmbedChartDialogProps) {
  const [theme, setTheme] = useState<ChartTheme>("dark");
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const embedUrl = `${origin}/embed/token/${address}?theme=${theme}`;
  const snippet = useMemo(() => buildEmbedSnippet(embedUrl, symbol), [embedUrl, symbol]);

  useEffect(() => {
    setCopied(false);
  }, [snippet]);

  // Close on Escape for keyboard users.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Embed chart"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-semibold">Embed this chart</h3>
          <button
            onClick={onClose}
            className="rounded-md px-2 text-ink-dim hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="mb-4 text-sm text-ink-dim">
          Paste this snippet into your website to share a live, responsive DUX chart. It scales to
          fit whatever container you drop it in.
        </p>

        {/* theme */}
        <div className="mb-4 flex items-center gap-3">
          <span className="text-[13px] text-ink-dim">Theme</span>
          <div className="flex items-center gap-1 rounded-lg bg-bg-soft p-0.5">
            {(["dark", "light"] as ChartTheme[]).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition ${
                  theme === t ? "bg-card text-ink shadow-sm" : "text-ink-dim hover:text-ink"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* live preview */}
        <div className="mb-4">
          <span className="mb-1.5 block text-[13px] text-ink-dim">Preview</span>
          <div className="overflow-hidden rounded-xl border border-line">
            <iframe
              key={embedUrl}
              src={embedUrl}
              title="DUX chart preview"
              className="block h-72 w-full border-0"
            />
          </div>
        </div>

        {/* snippet */}
        <div className="mb-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[13px] text-ink-dim">Embed code</span>
            <button
              onClick={copySnippet}
              className="rounded-lg bg-brand px-3 py-1 text-xs font-bold text-white transition hover:brightness-110"
            >
              {copied ? "Copied!" : "Copy code"}
            </button>
          </div>
          <textarea
            readOnly
            value={snippet}
            rows={5}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full resize-none rounded-lg border border-line bg-bg-soft px-3.5 py-2.5 font-mono text-[12px] leading-relaxed outline-none focus:border-brand"
          />
        </div>

        <a
          href={embedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-ink-dim transition hover:text-ink"
        >
          → Open the embed in a new tab
        </a>
      </div>
    </div>
  );
}
