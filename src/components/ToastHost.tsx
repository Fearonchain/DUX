import { useNavigate } from "react-router-dom";
import { useWatchlist, type Toast } from "../lib/watchlist";

/**
 * Fixed-position stack of in-app toasts, rendered once near the app root.
 * Price-alert notifications surface here (in addition to browser notifications).
 */
export default function ToastHost() {
  const { list_of_active_toasts, dismissToast } = useWatchlist();
  const navigate = useNavigate();

  if (list_of_active_toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
      {list_of_active_toasts.map((toast) => (
        <ToastCard
          key={toast.id}
          toast={toast}
          onDismiss={() => dismissToast(toast.id)}
          onOpen={() => {
            if (toast.address) navigate(`/token/${toast.address}`);
            dismissToast(toast.id);
          }}
        />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  onDismiss,
  onOpen,
}: {
  toast: Toast;
  onDismiss: () => void;
  onOpen: () => void;
}) {
  const accent =
    toast.tone === "up" ? "border-l-up" : toast.tone === "down" ? "border-l-down" : "border-l-brand";

  return (
    <div
      className={`pointer-events-auto animate-fade-in overflow-hidden rounded-xl border border-l-4 border-line bg-card p-3.5 shadow-lg shadow-black/10 ${accent}`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 text-left"
          title={toast.address ? "Open token" : undefined}
        >
          <p className="truncate text-sm font-semibold text-ink">{toast.title}</p>
          <p className="mt-0.5 truncate text-xs text-ink-dim">{toast.body}</p>
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="shrink-0 rounded-md p-1 text-ink-dim transition hover:bg-bg-soft hover:text-ink"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
