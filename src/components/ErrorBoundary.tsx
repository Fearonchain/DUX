import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Catches uncaught render errors anywhere below it so a single component crash
 * shows a recoverable message instead of white-screening the entire app.
 */
export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Uncaught render error:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="grid min-h-screen place-items-center bg-bg px-6 text-center">
        <div className="max-w-md">
          <h1 className="font-display text-2xl font-bold text-ink">Something went wrong</h1>
          <p className="mt-2 text-ink-dim">
            An unexpected error occurred. Reloading the page usually fixes it.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-xl bg-brand-strong px-5 py-2.5 font-bold text-white transition hover:brightness-110"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
