import { Link } from "react-router-dom";
import {
  useWatchlist,
  formatAlertValue,
  alertMetricLabel,
  type PriceAlert,
} from "../../lib/watchlist";
import { type TokenBrief } from "../../lib/market";
import { relTime, shortenAddress } from "../../lib/types";

interface AlertListProps {
  alerts: PriceAlert[];
  /** Show which token each alert belongs to (used on the watchlist page). */
  showToken?: boolean;
  briefs?: Record<string, TokenBrief>;
}

/** Renders and manages a set of price alerts (toggle, re-arm, remove). */
export default function AlertList({ alerts, showToken = false, briefs = {} }: AlertListProps) {
  const { toggleAlert, rearmAlert, removeAlert } = useWatchlist();

  if (alerts.length === 0) {
    return <p className="text-sm text-ink-dim">No alerts yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {alerts.map((alert) => {
        const triggered = alert.triggeredAt !== null;
        const brief = briefs[alert.address];
        const label = brief?.symbol?.trim() || shortenAddress(alert.address);

        return (
          <li
            key={alert.id}
            className="flex items-center gap-3 rounded-lg border border-line bg-bg-soft px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                {showToken && (
                  <Link
                    to={`/token/${alert.address}`}
                    className="font-semibold text-ink hover:text-brand"
                  >
                    {label}
                  </Link>
                )}
                <span className="text-ink">
                  <span className="text-ink-dim">{alertMetricLabel(alert.metric)}</span>{" "}
                  {alert.direction === "above" ? "rises above" : "falls below"}{" "}
                  <span className="font-mono font-semibold">
                    {formatAlertValue(alert.targetValue, alert.metric)}
                  </span>
                </span>
              </div>
              <p className="mt-0.5 text-xs">
                {triggered ? (
                  <span className="font-semibold text-up">
                    Triggered {relTime(new Date(alert.triggeredAt as number).toISOString())}
                  </span>
                ) : alert.enabled ? (
                  <span className="text-ink-dim">Active</span>
                ) : (
                  <span className="text-ink-dim">Paused</span>
                )}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {triggered ? (
                <button
                  type="button"
                  onClick={() => rearmAlert(alert.id)}
                  className="rounded-md border border-line bg-card px-2.5 py-1 text-xs font-semibold text-ink transition hover:border-accent"
                >
                  Re-arm
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => toggleAlert(alert.id)}
                  aria-pressed={alert.enabled}
                  className="rounded-md border border-line bg-card px-2.5 py-1 text-xs font-semibold text-ink-dim transition hover:border-accent hover:text-ink"
                >
                  {alert.enabled ? "Pause" : "Resume"}
                </button>
              )}
              <button
                type="button"
                onClick={() => removeAlert(alert.id)}
                aria-label="Remove alert"
                title="Remove alert"
                className="grid h-7 w-7 place-items-center rounded-md text-ink-dim transition hover:bg-card hover:text-down"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
