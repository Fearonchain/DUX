import { Routes, Route, Link, Outlet } from "react-router-dom";
import WalletProviders from "./components/WalletProviders";
import Landing from "./pages/Landing";
import TokenPage from "./pages/TokenPage";
import Feed from "./pages/Feed";
import Docs from "./pages/Docs";
import EmbedChart from "./pages/EmbedChart";

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
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold">
            <img src="/logo.png" alt="DUX logo" className="h-8 w-8" />
            DUX
          </Link>
          <nav className="flex gap-5 text-sm text-ink-dim">
            <Link to="/feed" className="hover:text-ink">
              Live Feed
            </Link>
            <Link to="/docs" className="hover:text-ink">
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
    <WalletProviders>
      <Routes>
        {/* Chrome-free chart for third-party <iframe> embeds. */}
        <Route path="/embed/token/:address" element={<EmbedChart />} />

        {/* Everything else renders inside the full DUX site chrome. */}
        <Route element={<SiteChrome />}>
          <Route path="/" element={<Landing />} />
          <Route path="/token/:address" element={<TokenPage />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/docs" element={<Docs />} />
        </Route>
      </Routes>
    </WalletProviders>
  );
}
