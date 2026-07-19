import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  fetchMarketPairsResilient,
  formatPriceUsd,
  formatUsdCompact,
  type MarketPair,
} from "./market";

/* ---------------------------------------------------------------------------
 * Local-first watchlist + price alerts.
 *
 * Everything persists to localStorage (mirroring the app's existing
 * `dux.feed.view` / `dux.search.recents` conventions) so no login or backend
 * is required. Alerts are evaluated by a single app-wide monitor that polls the
 * public market API while a DUX tab is open, and delivered via a browser
 * Notification plus an in-app toast. The provider API is intentionally shaped
 * so a backend sync could be layered on later without touching consumers.
 * ------------------------------------------------------------------------- */

export type AlertDirection = "above" | "below";

/** What a price alert watches: the token's USD price or its market cap. */
export type AlertMetric = "price" | "marketCap";

export interface WatchedToken {
  address: string;
  addedAt: number;
}

export interface PriceAlert {
  id: string;
  address: string;
  metric: AlertMetric;
  direction: AlertDirection;
  targetValue: number;
  enabled: boolean;
  createdAt: number;
  triggeredAt: number | null;
}

/** Read the metric a given alert watches from a live market pair. */
export function readAlertMetric(pair: MarketPair, metric: AlertMetric): number {
  return metric === "marketCap" ? pair.marketCap : pair.priceUsd;
}

/** Format an alert's target/observed value for its metric. */
export function formatAlertValue(value: number, metric: AlertMetric): string {
  return metric === "marketCap" ? formatUsdCompact(value) : formatPriceUsd(value);
}

/** Human label for an alert's metric. */
export function alertMetricLabel(metric: AlertMetric): string {
  return metric === "marketCap" ? "Market cap" : "Price";
}

export type ToastTone = "info" | "up" | "down";

export interface Toast {
  id: string;
  title: string;
  body: string;
  tone: ToastTone;
  address: string | null;
}

interface WatchlistContextValue {
  list_of_watched_tokens: WatchedToken[];
  watchedCount: number;
  isWatched: (address: string) => boolean;
  toggleWatchlist: (address: string) => void;
  removeFromWatchlist: (address: string) => void;

  list_of_alerts: PriceAlert[];
  alertsForToken: (address: string) => PriceAlert[];
  addAlert: (input: {
    address: string;
    metric: AlertMetric;
    direction: AlertDirection;
    targetValue: number;
  }) => void;
  toggleAlert: (id: string) => void;
  rearmAlert: (id: string) => void;
  removeAlert: (id: string) => void;
  clearTriggeredAlerts: () => void;

  list_of_active_toasts: Toast[];
  dismissToast: (id: string) => void;
}

const WATCHLIST_STORAGE_KEY = "dux.watchlist";
const ALERTS_STORAGE_KEY = "dux.alerts";

/** How often the alert monitor re-checks live prices, in milliseconds. */
const ALERT_POLL_MS = 20000;
/** How long an in-app toast stays on screen before auto-dismissing. */
const TOAST_TTL_MS = 9000;

const WatchlistContext = createContext<WatchlistContextValue | undefined>(undefined);

function readStoredJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Ask the browser for notification permission (best-effort, never throws). */
function requestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [list_of_watched_tokens, setWatchedTokens] = useState<WatchedToken[]>(() =>
    readStoredJson<WatchedToken[]>(WATCHLIST_STORAGE_KEY, [])
  );
  const [list_of_alerts, setAlerts] = useState<PriceAlert[]>(() =>
    readStoredJson<PriceAlert[]>(ALERTS_STORAGE_KEY, [])
  );
  const [list_of_active_toasts, setToasts] = useState<Toast[]>([]);

  // Persist to localStorage whenever the collections change.
  useEffect(() => {
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(list_of_watched_tokens));
  }, [list_of_watched_tokens]);

  useEffect(() => {
    window.localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(list_of_alerts));
  }, [list_of_alerts]);

  // Keep multiple open tabs in sync.
  useEffect(() => {
    function handleStorageChange(event: StorageEvent) {
      if (event.key === WATCHLIST_STORAGE_KEY) {
        setWatchedTokens(readStoredJson<WatchedToken[]>(WATCHLIST_STORAGE_KEY, []));
      } else if (event.key === ALERTS_STORAGE_KEY) {
        setAlerts(readStoredJson<PriceAlert[]>(ALERTS_STORAGE_KEY, []));
      }
    }
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  /* ----------------------------- toasts ------------------------------ */

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = makeId();
      setToasts((current) => [...current, { ...toast, id }]);
      window.setTimeout(() => dismissToast(id), TOAST_TTL_MS);
    },
    [dismissToast]
  );

  /* --------------------------- watchlist ----------------------------- */

  const isWatched = useCallback(
    (address: string) => list_of_watched_tokens.some((token) => token.address === address),
    [list_of_watched_tokens]
  );

  const removeFromWatchlist = useCallback((address: string) => {
    setWatchedTokens((current) => current.filter((token) => token.address !== address));
  }, []);

  const toggleWatchlist = useCallback((address: string) => {
    setWatchedTokens((current) => {
      if (current.some((token) => token.address === address)) {
        return current.filter((token) => token.address !== address);
      }
      return [{ address, addedAt: Date.now() }, ...current];
    });
  }, []);

  /* ----------------------------- alerts ------------------------------ */

  const alertsForToken = useCallback(
    (address: string) => list_of_alerts.filter((alert) => alert.address === address),
    [list_of_alerts]
  );

  const addAlert = useCallback(
    (input: {
      address: string;
      metric: AlertMetric;
      direction: AlertDirection;
      targetValue: number;
    }) => {
      requestNotificationPermission();
      setAlerts((current) => [
        {
          id: makeId(),
          address: input.address,
          metric: input.metric,
          direction: input.direction,
          targetValue: input.targetValue,
          enabled: true,
          createdAt: Date.now(),
          triggeredAt: null,
        },
        ...current,
      ]);
    },
    []
  );

  const toggleAlert = useCallback((id: string) => {
    setAlerts((current) =>
      current.map((alert) => (alert.id === id ? { ...alert, enabled: !alert.enabled } : alert))
    );
  }, []);

  const rearmAlert = useCallback((id: string) => {
    setAlerts((current) =>
      current.map((alert) =>
        alert.id === id ? { ...alert, triggeredAt: null, enabled: true } : alert
      )
    );
  }, []);

  const removeAlert = useCallback((id: string) => {
    setAlerts((current) => current.filter((alert) => alert.id !== id));
  }, []);

  const clearTriggeredAlerts = useCallback(() => {
    setAlerts((current) => current.filter((alert) => alert.triggeredAt === null));
  }, []);

  /* ------------------------- alert monitor --------------------------- */

  // Hold the latest alerts in a ref so the poll interval can be created once
  // (on mount) and always read current state without churning the timer.
  const alertsRef = useRef(list_of_alerts);
  useEffect(() => {
    alertsRef.current = list_of_alerts;
  }, [list_of_alerts]);

  const evaluatingRef = useRef(false);

  useEffect(() => {
    let stopped = false;

    async function evaluateAlerts() {
      if (evaluatingRef.current) return;
      const armed = alertsRef.current.filter(
        (alert) => alert.enabled && alert.triggeredAt === null
      );
      if (armed.length === 0) return;

      evaluatingRef.current = true;
      try {
        const marketByAddress = await fetchMarketPairsResilient([
          ...new Set(armed.map((alert) => alert.address)),
        ]);
        if (stopped) return;

        const firedIds = new Set<string>();
        for (const alert of armed) {
          const pair = marketByAddress[alert.address];
          if (!pair) continue;
          const observed = readAlertMetric(pair, alert.metric);
          if (!Number.isFinite(observed) || observed <= 0) continue;
          const crossed =
            alert.direction === "above"
              ? observed >= alert.targetValue
              : observed <= alert.targetValue;
          if (crossed) {
            firedIds.add(alert.id);
            deliverAlert(alert, pair, observed);
          }
        }

        if (firedIds.size > 0) {
          const triggeredAt = Date.now();
          setAlerts((current) =>
            current.map((alert) =>
              firedIds.has(alert.id) ? { ...alert, triggeredAt } : alert
            )
          );
        }
      } catch {
        /* transient error — next poll retries */
      } finally {
        evaluatingRef.current = false;
      }
    }

    function deliverAlert(alert: PriceAlert, pair: MarketPair, observed: number) {
      const symbol = pair.baseSymbol || "Token";
      const metricNoun = alert.metric === "marketCap" ? "market cap" : "price";
      const arrow = alert.direction === "above" ? "rose above" : "fell below";
      const title = `${symbol} ${metricNoun} ${arrow} ${formatAlertValue(alert.targetValue, alert.metric)}`;
      const body = `Now at ${formatAlertValue(observed, alert.metric)}`;

      pushToast({
        title,
        body,
        tone: alert.direction === "above" ? "up" : "down",
        address: alert.address,
      });

      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        try {
          const notification = new Notification(`DUX alert · ${title}`, {
            body,
            icon: "/logo.png",
            tag: alert.id,
          });
          notification.onclick = () => {
            window.focus();
            window.location.assign(`/token/${alert.address}`);
          };
        } catch {
          /* notification construction can throw on some platforms */
        }
      }
    }

    evaluateAlerts();
    const interval = window.setInterval(evaluateAlerts, ALERT_POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [pushToast]);

  const value = useMemo<WatchlistContextValue>(
    () => ({
      list_of_watched_tokens,
      watchedCount: list_of_watched_tokens.length,
      isWatched,
      toggleWatchlist,
      removeFromWatchlist,
      list_of_alerts,
      alertsForToken,
      addAlert,
      toggleAlert,
      rearmAlert,
      removeAlert,
      clearTriggeredAlerts,
      list_of_active_toasts,
      dismissToast,
    }),
    [
      list_of_watched_tokens,
      isWatched,
      toggleWatchlist,
      removeFromWatchlist,
      list_of_alerts,
      alertsForToken,
      addAlert,
      toggleAlert,
      rearmAlert,
      removeAlert,
      clearTriggeredAlerts,
      list_of_active_toasts,
      dismissToast,
    ]
  );

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist(): WatchlistContextValue {
  const context = useContext(WatchlistContext);
  if (!context) throw new Error("useWatchlist must be used within a WatchlistProvider");
  return context;
}
