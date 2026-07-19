import { Routes, Route, Link, Outlet } from "react-router-dom";
import { ThemeProvider } from "./lib/theme";
import { WatchlistProvider, useWatchlist } from "./lib/watchlist";
import ThemeToggle from "./components/ThemeToggle";
import ToastHost from "./components/ToastHost";
import WalletProviders from "./components/WalletProviders";
import GlobalSearch from "./components/GlobalSearch";
import Landing from "./pages/Landing";
import TokenPage from "./pages/TokenPage";
import Feed from "./pages/Feed";
import Docs from "./pages/Docs";
import Watchlist from "./pages/Watchlist";
import EmbedChart from "./pages/EmbedChart";

/** Header link to the watchlist, badged with the number of watched tokens. */
function WatchlistNavLink() {
  const { watchedCount } = useWatchlist();
  return (
    <Link to="/watchlist" className="inline-flex items-center gap-1.5 hover:text-ink">
      Watchlist
      {watchedCount > 0 && (
        <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-brand-soft px-1.5 text-[11px] font-bold text-brand">
          {watchedCount}
        </span>
      )}
    </Link>
  );
}

/** Full DUX site chrome (notice + header + footer) shared by every normal page. */
function SiteChrome() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* non-affiliation notice, keep visible on every page */}
      <div className="border-b border-line bg-bg-soft px-5 py-1.5 text-left text-[11px] text-ink-dim">
        This is <strong>not</strong> Dexscreener. Independent open-source project, not affiliated
        with, endorsed by, or connected to DEX Screener, Inc. in any way.
      </div>
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-5 py-4">
          <Link to="/" className="flex shrink-0 items-center gap-2 text-lg font-bold">
            <img src="/logo.png" alt="DUX logo" className="h-8 w-8" />
            DUX
          </Link>
          <div className="flex flex-1 justify-center">
            <GlobalSearch />
          </div>
          <nav className="flex shrink-0 items-center gap-5 text-sm text-ink-dim">
            <Link to="/feed" className="hidden hover:text-ink sm:inline">
              Live Feed
            </Link>
            <WatchlistNavLink />
            <Link to="/docs" className="hidden hover:text-ink sm:inline">
              API Docs
            </Link>
            <a
              href="https://github.com/Fearonchain/DUX"
              target="_blank"
              rel="noreferrer"
              className="hover:text-ink"
            >
              GitHub
            </a>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-5 pt-8">
        <Outlet />
      </main>
      <footer className="mt-12 border-t border-line">
        <div className="mx-auto w-full max-w-7xl px-5 py-6 text-center text-[13px] text-ink-dim">
          <p>Free &amp; open source. No fees, ever. Verification is fully on-chain.</p>
          <p className="mt-1.5 text-[11px]">
            DUX is an independent community project and is not affiliated with, endorsed by, or
            connected to DEX Screener, Inc. ("Dexscreener"). All trademarks are the property of
            their respective owners. This site provides token metadata submitted by verified token
            authorities/holders; nothing here is financial advice.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <WatchlistProvider>
        <WalletProviders>
          <Routes>
            {/* Chrome-free chart for third-party <iframe> embeds. */}
            <Route path="/embed/token/:address" element={<EmbedChart />} />

            {/* Everything else renders inside the full DUX site chrome. */}
            <Route element={<SiteChrome />}>
              <Route path="/" element={<Landing />} />
              <Route path="/token/:address" element={<TokenPage />} />
              <Route path="/feed" element={<Feed />} />
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/docs" element={<Docs />} />
            </Route>
          </Routes>
          <ToastHost />
        </WalletProviders>
      </WatchlistProvider>
    </ThemeProvider>
  );
}
