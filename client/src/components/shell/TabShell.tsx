import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

// The three-tab application shell. Desktop: a fixed top bar with the
// ForgeRealm mark and tabs. Mobile: a fixed bottom tab bar (thumb-reachable —
// the Mini Mall stock views get used one-handed in front of the shelf), plus
// a slim brand bar on top for the non-POS areas (POS has its own header).

const TABS = [
  {
    key: 'pos',
    label: 'Point of Sale',
    short: 'POS',
    to: '/',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 4.6A1 1 0 005.6 19H19M9 21a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z" />
      </svg>
    ),
  },
  {
    key: 'mini-mall',
    label: 'Mini Mall',
    short: 'Mini Mall',
    to: '/mini-mall',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h16M4 9h16M4 14h16M4 19h16M7 4v15M17 4v15" />
      </svg>
    ),
  },
  {
    key: 'expenses',
    label: 'Expenses',
    short: 'Expenses',
    to: '/expenses',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-2.2 0-4 .9-4 2s1.8 2 4 2 4 .9 4 2-1.8 2-4 2m0-8c1.66 0 3.06.5 3.66 1.2M12 8V6m0 10v2m0-12c-1.66 0-3.06.5-3.66 1.2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export function activeTabKey(pathname: string): string {
  if (pathname.startsWith('/mini-mall')) return 'mini-mall';
  if (pathname.startsWith('/expenses')) return 'expenses';
  return 'pos';
}

export default function TabShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const active = activeTabKey(location.pathname);

  return (
    <>
      {/* Desktop top bar */}
      <header className="hidden md:flex fixed top-0 inset-x-0 h-14 z-[60] items-center gap-8 px-6 bg-surface/90 backdrop-blur-xl border-b border-white/[0.06]">
        <button onClick={() => navigate('/')} className="flex items-center gap-2.5 shrink-0">
          <img src="/logo.png" alt="" className="w-8 h-8 rounded-lg object-cover" />
          <span
            className="font-display text-lg font-semibold"
            style={{
              backgroundImage: 'linear-gradient(135deg, #d4a843, #e4c373)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            ForgeRealm
          </span>
        </button>
        <nav className="flex items-center gap-1 h-full">
          {TABS.map((tab) => {
            const isActive = active === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => navigate(tab.to)}
                className={`relative h-full px-4 flex items-center gap-2 text-sm font-medium transition-colors duration-200
                  ${isActive ? 'text-gold' : 'text-gray-400 hover:text-gray-200'}`}
              >
                {tab.icon}
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="tab-underline"
                    className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-gradient-gold shadow-glow-gold-sm"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Mobile brand bar — only for areas that don't bring their own header */}
      {active !== 'pos' && (
        <header className="md:hidden fixed top-0 inset-x-0 z-40 bg-navy/80 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3 flex items-center justify-center gap-2">
          <img src="/logo.png" alt="" className="w-7 h-7 rounded-md object-cover" />
          <span
            className="font-display text-lg font-semibold"
            style={{
              backgroundImage: 'linear-gradient(135deg, #d4a843, #e4c373)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {TABS.find((t) => t.key === active)?.label}
          </span>
        </header>
      )}

      {/* Mobile bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-[60] bg-surface/95 backdrop-blur-xl border-t border-white/[0.08] flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => navigate(tab.to)}
              className={`flex-1 py-2.5 flex flex-col items-center gap-1 transition-colors duration-200
                ${isActive ? 'text-gold' : 'text-gray-500 active:text-gray-300'}`}
            >
              <div className={isActive ? 'drop-shadow-[0_0_6px_rgba(212,168,67,0.5)]' : ''}>
                {tab.icon}
              </div>
              <span className="text-[10px] font-medium tracking-wide">{tab.short}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
