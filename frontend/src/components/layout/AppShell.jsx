import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext.jsx';
import { setLanguage } from '../../i18n';
import { Logo } from '../branding/Logo.jsx';
import {
  HomeIcon,
  PosIcon,
  PillIcon,
  BoxIcon,
  TruckIcon,
  BuildingIcon,
  ChartIcon,
  ClipboardIcon,
  RefreshIcon,
  UndoIcon,
  CheckSquareIcon,
  CalendarIcon,
  MenuIcon,
  LogOutIcon,
  ChevronLeftIcon,
  SearchIcon,
} from '../ui/icons.jsx';

const STORAGE_KEY = 'medicap.sidebar.collapsed';

const SECTIONS = [
  {
    label: 'Overview',
    items: [
      { to: '/', key: 'nav.dashboard', Icon: HomeIcon, roles: ['OWNER', 'MANAGER', 'PHARMACIST'] },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/pos', key: 'nav.pos', Icon: PosIcon, roles: ['PHARMACIST', 'MANAGER', 'OWNER'] },
      { to: '/returns', key: 'nav.returns', Icon: UndoIcon, roles: ['OWNER', 'MANAGER'] },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { to: '/inventory/medicines', key: 'nav.medicines', Icon: PillIcon, roles: ['OWNER', 'MANAGER', 'PHARMACIST'] },
      { to: '/inventory/batches', key: 'nav.batches', Icon: CalendarIcon, roles: ['OWNER', 'MANAGER'] },
      { to: '/inventory/suppliers', key: 'nav.suppliers', Icon: BuildingIcon, roles: ['OWNER', 'MANAGER'] },
      { to: '/inventory/purchase-orders', key: 'nav.purchaseOrders', Icon: ClipboardIcon, roles: ['OWNER', 'MANAGER'] },
      { to: '/inventory/reorder', key: 'nav.reorder', Icon: RefreshIcon, roles: ['OWNER', 'MANAGER'] },
      { to: '/inventory/stock-counts', key: 'nav.stockCounts', Icon: CheckSquareIcon, roles: ['OWNER', 'MANAGER'] },
    ],
  },
  {
    label: 'Movement',
    items: [
      { to: '/transfers', key: 'nav.transfers', Icon: TruckIcon, roles: ['OWNER', 'MANAGER'] },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { to: '/reports', key: 'nav.reports', Icon: ChartIcon, roles: ['OWNER', 'MANAGER'] },
    ],
  },
];

const ROLE_LABEL = {
  OWNER: 'Owner · HQ',
  MANAGER: 'Branch Manager',
  PHARMACIST: 'Pharmacist',
};

export default function AppShell({ children }) {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      /* noop */
    }
  }, [collapsed]);

  function SidebarInner({ onNavigate }) {
    return (
      <div className="flex h-full flex-col bg-brand-nav text-white">
        {/* Brand — mint heartbeat + white "edicap" wordmark */}
        <div className={`flex items-center border-b border-brand-nav-line/50 ${collapsed ? 'h-20 justify-center' : 'h-20 px-5'}`}>
          {collapsed ? <Logo size={32} iconOnly /> : <Logo size={38} tone="dark" />}
        </div>

        <nav className="flex-1 overflow-y-auto py-4" aria-label="Primary">
          {SECTIONS.map((section) => (
            <div key={section.label} className={`mb-4 ${collapsed ? 'px-2' : 'px-3'}`}>
              {!collapsed && (
                <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                  {section.label}
                </div>
              )}
              <ul className="space-y-1">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      onClick={() => onNavigate?.()}
                      title={collapsed ? t(item.key) : undefined}
                      className={({ isActive }) =>
                        [
                          'group relative flex items-center rounded-lg text-[13.5px] font-medium transition-colors',
                          collapsed ? 'h-10 w-10 justify-center' : 'gap-3 px-3.5 py-2.5',
                          // Active: brand blue fill + white text (matches reference).
                          // Hover: slightly lifted navy — NEVER white.
                          isActive
                            ? 'bg-brand-chart text-white shadow-[inset_0_0_0_1px_rgba(94,234,212,0.3)]'
                            : 'text-white/75 hover:bg-brand-nav-raise/80 hover:text-white',
                        ].join(' ')
                      }
                    >
                      <item.Icon width={18} height={18} />
                      {!collapsed && <span className="truncate">{t(item.key)}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Bottom: user + logout */}
        <div className={`border-t border-brand-nav-line/80 p-3 ${collapsed ? 'flex flex-col items-center gap-2' : ''}`}>
          {collapsed ? (
            <>
              <div
                title={user.fullName}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-semibold text-brand-primary"
              >
                {user.fullName?.[0] ?? '?'}
              </div>
              <button
                type="button"
                onClick={logout}
                title={t('nav.logout')}
                aria-label={t('nav.logout')}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-white/70 hover:bg-brand-nav-raise hover:text-white"
              >
                <LogOutIcon width={15} height={15} />
              </button>
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 rounded-lg bg-brand-nav-raise/80 p-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-brand-primary">
                  {user.fullName?.[0] ?? '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-white">{user.fullName}</div>
                  <div className="truncate text-[11px] text-white/50">{ROLE_LABEL[user.role] || user.role}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-[12px] font-medium text-white/80 transition hover:border-white/30 hover:bg-brand-nav-raise/80 hover:text-white"
              >
                <LogOutIcon width={14} height={14} />
                <span>{t('nav.logout')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full bg-surface-page">
      {/* Desktop sidebar */}
      <aside
        className={`hidden shrink-0 transition-all duration-150 ease-out lg:block ${collapsed ? 'w-16' : 'w-60'}`}
      >
        <SidebarInner />
      </aside>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="absolute inset-y-0 left-0 w-60 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarInner onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-line bg-surface-panel px-4 sm:px-6">
          {/* Left: menu toggles */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-md p-2 text-ink-secondary hover:bg-surface-muted lg:hidden"
              aria-label="Open menu"
            >
              <MenuIcon width={18} height={18} />
            </button>
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="hidden rounded-md p-2 text-ink-secondary hover:bg-surface-muted lg:inline-flex"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <MenuIcon width={18} height={18} /> : <ChevronLeftIcon width={18} height={18} />}
            </button>
          </div>

          {/* Center: search */}
          <div className="flex min-w-0 flex-1 items-center">
            <label className="flex w-full max-w-xl items-center gap-2 rounded-xl border border-line bg-surface-sunken px-3.5 py-2 text-sm text-ink-muted">
              <SearchIcon width={16} height={16} />
              <input
                type="search"
                placeholder={t('common.searchPlaceholder') || 'Search medicines, batches, receipts…'}
                className="min-w-0 flex-1 bg-transparent text-ink-primary placeholder:text-ink-muted focus:outline-none"
              />
            </label>
          </div>

          {/* Right: lang + logout */}
          <div className="flex items-center gap-2">
            <nav className="hidden items-center rounded-lg border border-line p-0.5 sm:flex" aria-label={t('common.language')}>
              {['en', 'so'].map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLanguage(l)}
                  className={
                    i18n.language === l
                      ? 'rounded-md bg-brand-primary px-2.5 py-1 text-[11px] font-semibold text-white'
                      : 'rounded-md px-2.5 py-1 text-[11px] font-medium text-ink-secondary hover:bg-surface-muted'
                  }
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </nav>
            <div className="flex items-center gap-2 rounded-full border border-line bg-surface-panel py-1 pl-1 pr-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-xs font-semibold text-white">
                {user.fullName?.[0] ?? '?'}
              </div>
              <div className="hidden min-w-0 sm:block">
                <div className="truncate text-[12px] font-semibold text-ink-primary">{user.fullName}</div>
                <div className="truncate text-[10px] text-ink-secondary">{ROLE_LABEL[user.role] || user.role}</div>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden bg-surface-page">
          <div className="mx-auto w-full max-w-7xl px-2 py-4">{children}</div>
        </main>
      </div>
    </div>
  );
}
