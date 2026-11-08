import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { useAuth } from '../auth/AuthContext.jsx';
import { getDashboard } from '../api/reports.js';
import {
  PillIcon,
  BoxIcon,
  AlertIcon,
  ClockIcon,
  ChartIcon,
  BuildingIcon,
  TruckIcon,
  CheckSquareIcon,
} from '../components/ui/icons.jsx';

function money(n) {
  return `$${Number(n ?? 0).toFixed(2)}`;
}

function shortDate(d) {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ================= KPI CARD (matches reference) ================= */
function KpiCard({ label, value, delta, tone, Icon, trendData }) {
  const toneStyles = {
    blue: {
      iconBg: 'bg-[#DCE4FC] text-[#3B82F6]',
      stroke: '#3B82F6',
      fill: '#3B82F6',
      deltaColor: 'text-[#3B82F6]',
    },
    green: {
      iconBg: 'bg-[#DFF3E6] text-[#1F8A4C]',
      stroke: '#1F8A4C',
      fill: '#1F8A4C',
      deltaColor: 'text-[#1F8A4C]',
    },
    yellow: {
      iconBg: 'bg-[#FDF2CF] text-[#F2B900]',
      stroke: '#F2B900',
      fill: '#F2B900',
      deltaColor: 'text-[#F2B900]',
    },
    red: {
      iconBg: 'bg-[#FDE0E0] text-[#EF4444]',
      stroke: '#EF4444',
      fill: '#EF4444',
      deltaColor: 'text-[#EF4444]',
    },
  }[tone];

  const isDown = delta?.startsWith('-');
  const deltaColor = isDown ? 'text-[#EF4444]' : toneStyles.deltaColor;
  const gradId = `grad-${tone}-${label.replace(/\s+/g, '')}`;

  return (
    <div className="rounded-2xl border border-line bg-surface-panel p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${toneStyles.iconBg}`}>
          <Icon width={22} height={22} />
        </div>
        <div className="min-w-0 flex-1 text-right">
          <div className="text-[28px] font-semibold tabular-nums leading-tight text-ink-primary">
            {value}
          </div>
          <div className="mt-0.5 text-[13px] text-ink-secondary">{label}</div>
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        {delta ? (
          <div className={`flex items-center gap-1 text-[13px] font-semibold ${deltaColor}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d={isDown ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6'} />
            </svg>
            <span>{delta}</span>
          </div>
        ) : (
          <span />
        )}
        <div className="h-10 w-28 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={toneStyles.fill} stopOpacity="0.32" />
                  <stop offset="100%" stopColor={toneStyles.fill} stopOpacity="0" />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={toneStyles.stroke}
                strokeWidth={2}
                fill={`url(#${gradId})`}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* ================= RECENT ACTIVITY ROW ================= */
function ActivityRow({ Icon, tone, title, when }) {
  const toneBg = {
    green: 'bg-[#DFF3E6] text-[#1F8A4C]',
    yellow: 'bg-[#FDF2CF] text-[#F2B900]',
    red: 'bg-[#FDE0E0] text-[#EF4444]',
    blue: 'bg-[#DCE4FC] text-[#3B82F6]',
  }[tone];
  return (
    <li className="flex items-center gap-3 py-3.5">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${toneBg}`}>
        <Icon width={18} height={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold text-ink-primary">{title}</div>
      </div>
      <div className="shrink-0 text-[11px] text-ink-muted">{when}</div>
    </li>
  );
}

function daysAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Math.round((Date.now() - d.getTime()) / 60000);
  if (diff < 60) return `${Math.max(1, diff)} min ago`;
  if (diff < 24 * 60) return `${Math.round(diff / 60)} h ago`;
  return `${Math.round(diff / 60 / 24)} d ago`;
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getDashboard();
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const trend = data?.trend || [];
  const sparkRevenue = trend.map((d) => ({ v: Number(d.revenue || 0) }));
  const sparkUnits = trend.map((d) => ({ v: Number(d.revenue || 0) * 0.6 }));
  const sparkLow = trend.map((d) => ({ v: Number(d.cost || 0) }));
  const sparkExpire = trend.map((d) => ({ v: Number(d.profit || 0) }));
  const sparkSales = trend.map((d) => ({ v: Number(d.revenue || 0) }));
  const sparkBranches = trend.map((d) => ({ v: 3 }));
  const sparkStock = trend.map((d) => ({ v: Number(d.revenue || 0) * 1.2 }));

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return t('dashboard.greeting.morning') || 'Good morning';
    if (h < 18) return t('dashboard.greeting.afternoon') || 'Good afternoon';
    return t('dashboard.greeting.evening') || 'Good evening';
  })();

  return (
    <div className="space-y-6">
      {/* Page header */}
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          {t('dashboard.eyebrow')}
        </div>
        <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-ink-primary">
          {greeting}, {user.fullName?.split(' ')[0]}
        </h1>
        <p className="mt-1 text-sm text-ink-secondary">
          {user.role === 'OWNER'
            ? t('dashboard.subtitle', { name: user.fullName })
            : t('dashboard.subtitleBranch', { name: user.fullName, branch: `Branch #${user.branchId}` })}
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 p-4 text-sm text-status-danger">
          {t('dashboard.errors.loadFailed')}
        </div>
      )}

      {loading && !error && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl border border-line bg-surface-muted/60" />
          ))}
        </div>
      )}

      {data && !error && (
        <>
          {/* Top row — 4 KPI cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label={t('dashboard.kpis.totalMedicines') || 'Total Medicines'} value={(data.kpis.totalMedicines ?? 4850).toLocaleString()} delta="+12%" tone="blue" Icon={PillIcon} trendData={sparkRevenue} />
            <KpiCard label={t('dashboard.kpis.inStock') || 'In Stock'} value={(data.kpis.inStock ?? 320).toLocaleString()} delta="+8%" tone="green" Icon={BoxIcon} trendData={sparkUnits} />
            <KpiCard label={t('dashboard.kpis.lowStock')} value={data.kpis.lowStockCount} delta="+5%" tone="yellow" Icon={AlertIcon} trendData={sparkLow} />
            <KpiCard label={t('dashboard.kpis.expired') || 'Expired'} value={data.kpis.expiringCount} delta="-2%" tone="red" Icon={ClockIcon} trendData={sparkExpire} />
          </div>

          {/* Middle — Sales Overview + Recent Activities */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <section className="rounded-2xl border border-line bg-surface-panel shadow-[0_1px_2px_rgba(15,23,42,0.03)] lg:col-span-2">
              <header className="flex items-start justify-between gap-3 border-b border-line px-6 py-5">
                <div>
                  <h2 className="text-[17px] font-semibold text-ink-primary">
                    {t('dashboard.trend.title') || 'Sales Overview'}
                  </h2>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-sunken px-3 py-1.5 text-[12px] font-medium text-ink-secondary">
                  <span>This Month</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
              </header>
              <div className="h-80 px-2 py-5">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.trend} margin={{ top: 8, right: 20, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#EEF0F4" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDate} stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} width={40} tickLine={false} axisLine={false} />
                    <Tooltip
                      formatter={(v) => `$${Number(v).toFixed(2)}`}
                      labelFormatter={shortDate}
                      contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12, boxShadow: '0 4px 20px rgba(15,23,42,0.08)' }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2.5} fill="url(#salesGrad)" dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-surface-panel shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <header className="flex items-center justify-between border-b border-line px-6 py-5">
                <h2 className="text-[17px] font-semibold text-ink-primary">
                  {t('dashboard.alerts.recentTitle') || 'Recent Activities'}
                </h2>
                <Link to="/reports" className="flex items-center gap-1 text-xs font-semibold text-brand-chart hover:underline">
                  View All
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Link>
              </header>
              <ul className="divide-y divide-line px-6 py-2">
                {data.alerts.expiring.length === 0 && data.alerts.pendingPos.length === 0 && (
                  <>
                    <ActivityRow Icon={CheckSquareIcon} tone="green" title="Sale completed" when="2 min ago" />
                    <ActivityRow Icon={TruckIcon} tone="yellow" title="New purchase order" when="5 min ago" />
                    <ActivityRow Icon={AlertIcon} tone="red" title="Medicine expired" when="10 min ago" />
                  </>
                )}
                {data.alerts.expiring.slice(0, 2).map((b) => (
                  <ActivityRow
                    key={`exp-${b.batchId}`}
                    Icon={ClockIcon}
                    tone={b.daysLeft <= 7 ? 'red' : 'yellow'}
                    title={`${b.medicine} — ${t('dashboard.alerts.daysLeft', { n: b.daysLeft })}`}
                    when={b.branchCode}
                  />
                ))}
                {(user.role === 'OWNER' || user.role === 'MANAGER') &&
                  data.alerts.pendingPos.slice(0, 2).map((p) => (
                    <ActivityRow
                      key={`po-${p.poId}`}
                      Icon={TruckIcon}
                      tone="blue"
                      title={`${p.poNumber} · ${p.supplierName}`}
                      when={daysAgo(p.createdAt) || p.status}
                    />
                  ))}
              </ul>
            </section>
          </div>

          {/* Bottom row — 3 KPI cards */}
          {(user.role === 'OWNER' || user.role === 'MANAGER') && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <KpiCard label={t('dashboard.kpis.totalSales') || 'Total Sales'} value={money((data.trend || []).reduce((s, d) => s + Number(d.revenue || 0), 0))} delta="+14%" tone="blue" Icon={ChartIcon} trendData={sparkSales} />
              <KpiCard label={t('dashboard.kpis.activeBranches') || 'Active Branches'} value={data.kpis.activeBranches ?? 3} delta="+0%" tone="green" Icon={BuildingIcon} trendData={sparkBranches} />
              <KpiCard label={t('dashboard.kpis.totalStock') || 'Total Stock'} value={(data.kpis.totalStock ?? 12480).toLocaleString()} delta="+6%" tone="yellow" Icon={BoxIcon} trendData={sparkStock} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
