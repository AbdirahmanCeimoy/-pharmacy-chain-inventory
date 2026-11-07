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
} from '../ui/icons.jsx';

const STORAGE_KEY = 'pharmatrack.sidebar.collapsed';

// Grouped sidebar — matches the reference layout: uppercase section labels,
// icon + text rows, active-row highlight, collapsible to icons-only.
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
      {
        to: '/inventory/medicines',
        key: 'nav.medicines',
        Icon: PillIcon,
        roles: ['OWNER', 'MANAGER', 'PHARMACIST'],
      },
      {
        to: '/inventory/batches',
        key: 'nav.batches',
        Icon: CalendarIcon,
        roles: ['OWNER', 'MANAGER'],
      },
      {
        to: '/inventory/suppliers',
        key: 'nav.suppliers',
        Icon: BuildingIcon,
        roles: ['OWNER', 'MANAGER'],
      },
      {
        to: '/inventory/purchase-orders',
        key: 'nav.purchaseOrders',
        Icon: ClipboardIcon,
        roles: ['OWNER', 'MANAGER'],
      },
      {
        to: '/inventory/reorder',
        key: 'nav.reorder',
        Icon: RefreshIcon,
        roles: ['OWNER', 'MANAGER'],
      },
      {
        to: '/inventory/stock-counts',
        key: 'nav.stockCounts',
        Icon: CheckSquareIcon,
        roles: ['OWNER', 'MANAGER'],
      },
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
    items: [{ to: '/reports', key: 'nav.reports', Icon: ChartIcon, roles: ['OWNER', 'MANAGER'] }],
  },
];

const ROLE_LABEL = {
  OWNER: 'Owner / HQ',
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

  // Every role sees the same sidebar (the server still enforces RBAC on the
  // routes themselves; hiding links in the UI would just confuse managers
  // demoing to owners and vice-versa).
  const sections = SECTIONS;

  function SidebarInner({ onNavigate }) {
    return (
      <div className={`flex h-full flex-col bg-surface-panel ${collapsed ? 'items-center' : ''}`}>
        <div
          className={`flex items-center border-b border-line ${
            collapsed ? 'h-12 w-full justify-center' : 'h-12 w-full px-3'
          }`}
        >
          {collapsed ? (
            <Logo size={26} />
          ) : (
            <Logo
              size={26}
              withWordmark
              wordmarkClassName="text-sm font-semibold text-ink-primary"
            />
          )}
        </div>
        <nav
          className={`flex-1 overflow-y-auto py-2 ${collapsed ? 'w-full' : 'w-full'}`}
          aria-label="Primary"
        >
          {sections.map((section) => (
            <div key={section.label} className={`mb-1 ${collapsed ? 'px-1.5' : 'px-2'}`}>
              {!collapsed && (
                <div className="mb-0.5 px-2 text-[9px] font-semibold uppercase tracking-wider text-ink-muted">
                  {section.label}
                </div>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      onClick={() => onNavigate?.()}
                      title={collapsed ? t(item.key) : undefined}
                      className={({ isActive }) =>
                        [
                          'group relative flex items-center rounded-md text-[12.5px] font-medium transition-colors',
                          collapsed ? 'h-8 w-8 justify-center' : 'gap-2.5 px-2.5 py-1.5',
                          // Active = blue tint + blue bold text + a left blue bar (inset shadow,
                          // so it adds no layout). Hover (either state) replaces that with solid
                          // chart-blue + white text, so only the row the cursor is on reads as
                          // "pressed" and nothing else does.
                          isActive
                            ? 'bg-brand-chart/15 text-brand-chart font-semibold shadow-[inset_3px_0_0_#3B82F6] hover:bg-brand-chart hover:text-white hover:shadow-none'
                            : 'text-ink-secondary hover:bg-brand-chart hover:text-white',
                        ].join(' ')
                      }
                    >
                      <item.Icon width={15} height={15} />
                      {!collapsed && <span className="truncate">{t(item.key)}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        {/* Sidebar bottom: profile card with sign-out directly below it, as
            the user asked — one glance shows who is signed in, one click to
            leave. */}
        <div className={`border-t border-line p-2 ${collapsed ? 'flex flex-col items-center gap-1.5' : ''}`}>
          {collapsed ? (
            <>
              <div
                title={user.fullName}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-xs font-semibold text-white"
              >
                {user.fullName?.[0] ?? '?'}
              </div>
              <button
                type="button"
                onClick={logout}
                title={t('nav.logout')}
                aria-label={t('nav.logout')}
                className="flex h-8 w-8 items-center justify-center rounded-md text-ink-secondary hover:bg-status-danger/10 hover:text-status-danger"
              >
                <LogOutIcon width={14} height={14} />
              </button>
            </>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 rounded-md bg-surface-muted/60 p-1.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-primary text-xs font-semibold text-white">
                  {user.fullName?.[0] ?? '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-ink-primary">
                    {user.fullName}
                  </div>
                  <div className="truncate text-[10px] text-ink-secondary">
                    {ROLE_LABEL[user.role] || user.role}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-line bg-surface-panel px-3 py-1.5 text-xs font-medium text-ink-secondary transition hover:border-status-danger/40 hover:bg-status-danger/10 hover:text-status-danger"
              >
                <LogOutIcon width={13} height={13} />
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
        className={`hidden shrink-0 border-r border-line transition-all duration-150 ease-out lg:block ${
          collapsed ? 'w-12' : 'w-48'
        }`}
      >
        <SidebarInner />
      </aside>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-ink-primary/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="absolute inset-y-0 left-0 w-48 border-r border-line shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarInner onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-12 items-center justify-between gap-3 border-b border-line bg-surface-panel px-3 sm:px-4">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-md p-1.5 text-ink-secondary hover:bg-surface-muted lg:hidden"
              aria-label="Open menu"
            >
              <MenuIcon width={16} height={16} />
            </button>
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="hidden rounded-md p-1.5 text-ink-secondary hover:bg-surface-muted lg:inline-flex"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <MenuIcon width={16} height={16} />
              ) : (
                <ChevronLeftIcon width={16} height={16} />
              )}
            </button>
            <span className="hidden text-xs font-semibold text-ink-primary sm:inline">
              PharmaTrack
            </span>
          </div>
          <div className="flex items-center gap-2">
            <nav
              className="flex items-center rounded-md border border-line p-0.5"
              aria-label={t('common.language')}
            >
              {['en', 'so'].map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLanguage(l)}
                  className={
                    i18n.language === l
                      ? 'rounded px-2 py-0.5 text-[11px] font-semibold text-brand-chart bg-brand-chart/10'
                      : 'rounded px-2 py-0.5 text-[11px] font-medium text-ink-secondary hover:bg-surface-muted'
                  }
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </nav>
            {/* Top-right only carries a quick-exit sign-out link; the full
                user chip lives in the sidebar as the user asked. */}
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium text-ink-secondary transition hover:bg-status-danger/10 hover:text-status-danger"
            >
              <LogOutIcon width={13} height={13} />
              <span>{t('nav.logout')}</span>
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-5">{children}</div>
        </main>
      </div>
    </div>
  );
}
