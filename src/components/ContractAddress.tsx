import { useState } from "react";
import { Link } from "react-router-dom";
import { TOKEN_CONTRACT_ADDRESS } from "../lib/config";
import { DEFAULT_CHAIN_ID } from "../lib/chains";

/**
 * Copyable $TORCH contract-address chip. Shows the mint (full or shortened),
 * links through to its token page, and copies the full address to the clipboard.
 * Renders nothing until a contract address is configured.
 */
export default function ContractAddress({
  full = false,
  className = "",
}: {
  full?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const contractAddress = TOKEN_CONTRACT_ADDRESS;
  if (!contractAddress) return null;
  const shortened = `${contractAddress.slice(0, 4)}…${contractAddress.slice(-4)}`;

  function copyToClipboard() {
    navigator.clipboard
      ?.writeText(contractAddress)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  return (
    <span
      className={`inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-bg-soft px-3 py-1.5 font-mono text-xs ${className}`}
    >
      <span className="font-sans font-semibold uppercase tracking-wide text-ink-dim">CA</span>
      <Link
        to={`/token/${DEFAULT_CHAIN_ID}/${contractAddress}`}
        className="truncate text-ink transition hover:text-brand"
        title="Open $TORCH token page"
      >
        {full ? contractAddress : shortened}
      </Link>
      <button
        type="button"
        onClick={copyToClipboard}
        aria-label="Copy contract address"
        className="shrink-0 text-ink-dim transition hover:text-ink"
      >
        {copied ? (
          <span className="font-sans font-semibold text-up">copied</span>
        ) : (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </svg>
        )}
      </button>
    </span>
  );
}
