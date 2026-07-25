import { useEffect, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { Routes, Route, Link, NavLink, Outlet, Navigate, useLocation, useParams } from "react-router-dom";
import { ThemeProvider } from "./lib/theme";
import { DEFAULT_CHAIN_ID } from "./lib/chains";
import { WatchlistProvider, useWatchlist } from "./lib/watchlist";
import ThemeToggle from "./components/ThemeToggle";
import ToastHost from "./components/ToastHost";
import WalletProviders, { WalletButton } from "./components/WalletProviders";
import GlobalSearch from "./components/GlobalSearch";
import ContractAddress from "./components/ContractAddress";
import Logo from "./components/Logo";
import { TOKEN_CONTRACT_ADDRESS } from "./lib/config";
import Landing from "./pages/Landing";
import TokenPage from "./pages/TokenPage";
import AddToken from "./pages/AddToken";
import Feed from "./pages/Feed";
import Docs from "./pages/Docs";
import Watchlist from "./pages/Watchlist";
import Portfolio from "./pages/Portfolio";
import EmbedChart from "./pages/EmbedChart";

const GITHUB_URL = "https://github.com/thebagworker/DUX";

type IconProps = { className?: string };

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<IconProps>;
  end?: boolean;
  badge?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Home", icon: HomeIcon, end: true },
  { to: "/feed", label: "Live Feed", icon: PulseIcon },
  { to: "/portfolio", label: "Portfolio", icon: WalletIcon },
  { to: "/watchlist", label: "Watchlist", icon: StarIcon, badge: true },
  { to: "/docs", label: "API Docs", icon: BookIcon },
];

/** Small pill showing how many tokens are on the watchlist. */
function WatchlistBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-brand-soft px-1.5 text-[11px] font-bold text-brand">
      {count}
    </span>
  );
}

/** A single navigation row shared by the desktop sidebar and the mobile drawer. */
function NavRow({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const { watchedCount } = useWatchlist();
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
          isActive
            ? "bg-brand-soft text-brand"
            : "text-ink-dim hover:bg-bg-soft hover:text-ink"
        }`
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.badge && <WatchlistBadge count={watchedCount} />}
    </NavLink>
  );
}

/** Bright, always-visible call to action to launch the "Add your token" wizard. */
function AddTokenCta({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      to="/add"
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-brand transition hover:bg-brand-soft"
    >
      <PlusFlameIcon className="h-[18px] w-[18px] shrink-0" />
      Add your token
    </Link>
  );
}

/** GitHub row (external link) styled to match the nav rows. */
function GithubRow() {
  return (
    <a
      href={GITHUB_URL}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-dim transition hover:bg-bg-soft hover:text-ink"
    >
      <GithubIcon className="h-[18px] w-[18px] shrink-0" />
      <span className="flex-1">GitHub</span>
    </a>
  );
}

/** Persistent left sidebar shown on large screens. */
function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-card lg:flex">
      <div className="px-5 py-5">
        <Link to="/" aria-label="Torch home">
          <Logo />
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {NAV_ITEMS.map((item) => (
          <NavRow key={item.to} item={item} />
        ))}
        <AddTokenCta />
      </nav>
      <div className="space-y-3 border-t border-line p-3">
        <GithubRow />
        {TOKEN_CONTRACT_ADDRESS && (
          <div className="px-1">
            <ContractAddress className="w-full justify-center" />
          </div>
        )}
      </div>
    </aside>
  );
}

/** Hamburger + slide-in drawer that mirrors the sidebar on small screens. */
function MobileDrawer() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="grid h-9 w-9 place-items-center rounded-lg border border-line text-ink-dim transition hover:border-accent hover:text-ink"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Menu">
            <div
              className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <div className="absolute left-0 top-0 flex h-full w-72 max-w-[85%] animate-fade-in flex-col border-r border-line bg-card shadow-2xl shadow-black/25">
              <div className="flex items-center justify-between border-b border-line px-4 py-4">
                <Logo />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="grid h-8 w-8 place-items-center rounded-lg text-ink-dim transition hover:bg-bg-soft hover:text-ink"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
              {NAV_ITEMS.map((item) => (
                <NavRow key={item.to} item={item} onNavigate={() => setOpen(false)} />
              ))}
              <AddTokenCta onNavigate={() => setOpen(false)} />
              <GithubRow />
            </nav>
              {TOKEN_CONTRACT_ADDRESS && (
                <div className="border-t border-line p-3">
                  <ContractAddress className="w-full justify-center" />
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

/** Sticky top bar: mobile menu + compact logo, global search, theme + wallet. */
function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-bg/80 px-4 py-3 backdrop-blur sm:gap-3 sm:px-6">
      <MobileDrawer />
      <Link to="/" className="flex items-center lg:hidden" aria-label="Torch home">
        <Logo showWordmark={false} />
      </Link>
      <div className="flex min-w-0 flex-1 justify-center">
        <GlobalSearch />
      </div>
      <ThemeToggle />
      <div className="shrink-0">
        <WalletButton />
      </div>
    </header>
  );
}

/** Slim, always-visible non-affiliation notice. */
function ComplianceStrip() {
  return (
    <div className="border-b border-line bg-bg-soft px-4 py-1.5 text-center text-[11px] text-ink-dim sm:px-6">
      This is <strong>not</strong> Dexscreener — an independent, open-source project, not affiliated
      with or endorsed by DEX Screener, Inc.
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-12 border-t border-line">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 text-center text-[13px] text-ink-dim sm:px-6">
        {TOKEN_CONTRACT_ADDRESS && (
          <div className="mb-4 flex justify-center">
            <ContractAddress />
          </div>
        )}
        <p className="font-semibold text-ink">
          Torch — free, open-source token info. Burn the paywall.
        </p>
        <p className="mt-1">No fees, ever. Verification is fully on-chain.</p>
        <p className="mt-3 text-[11px]">
          Torch is an independent community project and is not affiliated with, endorsed by, or
          connected to DEX Screener, Inc. ("Dexscreener"). All trademarks are the property of their
          respective owners. This site provides token metadata submitted by verified token
          authorities/holders; nothing here is financial advice.
        </p>
      </div>
    </footer>
  );
}

/**
 * Redirect legacy chain-less token/add links (`/token/:address`) to their
 * chain-aware equivalent, defaulting to Solana so every pre-multichain link
 * keeps working. The `prefix` is the route base ("token", "add" or
 * "embed/token").
 */
function ChainCompatRedirect({ prefix }: { prefix: string }) {
  const { address = "" } = useParams();
  return <Navigate to={`/${prefix}/${DEFAULT_CHAIN_ID}/${address}`} replace />;
}

function NotFound() {
  return (
    <div className="py-16 text-center">
      <p className="font-display text-5xl font-bold text-brand">404</p>
      <h1 className="mt-3 text-2xl font-bold">Page not found</h1>
      <p className="mx-auto mt-2 max-w-md text-ink-dim">
        The page you're looking for doesn't exist or has moved.
      </p>
      <Link
        to="/"
        className="mt-5 inline-block rounded-xl bg-brand-strong px-5 py-2.5 font-bold text-white transition hover:brightness-110"
      >
        Back to home
      </Link>
    </div>
  );
}

/** Full Torch app shell (compliance strip + sidebar + top bar + footer). */
function SiteChrome() {
  return (
    <div className="min-h-screen bg-bg">
      <ComplianceStrip />
      <div className="flex">
        <Sidebar />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 sm:px-6">
            <Outlet />
          </main>
          <Footer />
        </div>
      </div>
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
            <Route path="/embed/token/:chainId/:address" element={<EmbedChart />} />
            <Route
              path="/embed/token/:address"
              element={<ChainCompatRedirect prefix="embed/token" />}
            />

            {/* Everything else renders inside the full Torch app shell. */}
            <Route element={<SiteChrome />}>
              <Route path="/" element={<Landing />} />
              <Route path="/add" element={<AddToken />} />
              <Route path="/add/:chainId/:address" element={<AddToken />} />
              <Route path="/add/:address" element={<ChainCompatRedirect prefix="add" />} />
              <Route path="/token/:chainId/:address" element={<TokenPage />} />
              <Route path="/token/:address" element={<ChainCompatRedirect prefix="token" />} />
              <Route path="/feed" element={<Feed />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
          <ToastHost />
        </WalletProviders>
      </WatchlistProvider>
    </ThemeProvider>
  );
}

/* --- Icons ---------------------------------------------------------------- */

function HomeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}

function PulseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h4l2.5 7 5-14 2.5 7H21" />
    </svg>
  );
}

function WalletIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H17a2 2 0 0 1 2 2v1" />
      <path d="M3 7.5V17a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5.5A2.5 2.5 0 0 1 3 7.5Z" />
      <path d="M16.5 13.5h.01" />
    </svg>
  );
}

function StarIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3.5 2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.77l-5.2 2.73.99-5.79-4.21-4.1 5.82-.85z" />
    </svg>
  );
}

function BookIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H19v13H6a2 2 0 0 0-2 2z" />
      <path d="M4 19a2 2 0 0 1 2-2h13" />
    </svg>
  );
}

function PlusFlameIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function GithubIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.35 9.35 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.35 4.81-4.58 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.6.69.49A10.01 10.01 0 0 0 22 12.25C22 6.58 17.52 2 12 2z" />
    </svg>
  );
}
