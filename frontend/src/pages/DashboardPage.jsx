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
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../auth/AuthContext.jsx';
import { getDashboard } from '../api/reports.js';
import { PosIcon, PillIcon, BoxIcon, CalendarIcon } from '../components/ui/icons.jsx';

function money(n) {
  return `$${Number(n ?? 0).toFixed(2)}`;
}

function shortDate(d) {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function KpiTile({ label, value, hint, tone = 'default', Icon }) {
  // unslop pass: flat tinted surface (no hue gradients), one accent bar on the
  // left as the tone signifier, weights capped at 600, no hover rise animation.
  const toneConfig = {
    default: {
      border: 'border-line',
      value: 'text-ink-primary',
      iconBg: 'bg-surface-muted text-ink-secondary',
      bar: 'bg-line',
    },
    warning: {
      border: 'border-line',
      value: 'text-ink-primary',
      iconBg: 'bg-status-warning/10 text-status-warning',
      bar: 'bg-status-warning',
    },
    danger: {
      border: 'border-line',
      value: 'text-ink-primary',
      iconBg: 'bg-status-danger/10 text-status-danger',
      bar: 'bg-status-danger',
    },
    success: {
      border: 'border-line',
      value: 'text-ink-primary',
      iconBg: 'bg-status-success/10 text-status-success',
      bar: 'bg-status-success',
    },
    info: {
      border: 'border-line',
      value: 'text-ink-primary',
      iconBg: 'bg-brand-chart/10 text-brand-chart',
      bar: 'bg-brand-chart',
    },
  }[tone];
  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-surface-panel p-4 ${toneConfig.border}`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${toneConfig.bar}`} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-medium text-ink-secondary">{label}</div>
          <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneConfig.value}`}>
            {value}
          </div>
          {hint && <div className="mt-1 text-[11px] text-ink-secondary">{hint}</div>}
        </div>
        {Icon && (
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneConfig.iconBg}`}
          >
            <Icon width={18} height={18} />
          </div>
        )}
      </div>
    </div>
  );
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

  const subtitle =
    user.role === 'OWNER'
      ? t('dashboard.subtitle', { name: user.fullName })
      : t('dashboard.subtitleBranch', {
          name: user.fullName,
          branch: `Branch #${user.branchId}`,
        });

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="text-xs text-ink-muted" aria-label="Breadcrumb">
        <ol className="flex items-center gap-1">
          <li>{t('app.name')}</li>
          <li aria-hidden>/</li>
          <li className="text-ink-primary">{t('dashboard.title')}</li>
        </ol>
      </nav>

      {/* Page header */}
      <header>
        <div className="text-xs font-medium text-brand-chart">{t('dashboard.eyebrow')}</div>
        <h1 className="mt-1 text-2xl font-semibold text-ink-primary sm:text-3xl">
          {t('dashboard.title')}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-secondary">{subtitle}</p>
      </header>

      {error && (
        <div className="rounded-md border border-status-danger/30 bg-status-danger/10 p-4 text-sm text-status-danger">
          {t('dashboard.errors.loadFailed')}
        </div>
      )}

      {loading && !error && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg border border-line bg-surface-muted/50" />
          ))}
        </div>
      )}

      {data && !error && (
        <>
          {/* KPI tiles */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile
              label={t('dashboard.kpis.todayRevenue')}
              value={money(data.kpis.todayRevenue)}
              hint={t('dashboard.kpis.todayRevenueHint')}
              tone="info"
              Icon={PosIcon}
            />
            <KpiTile
              label={t('dashboard.kpis.unitsSold')}
              value={data.kpis.todayUnits.toLocaleString()}
              hint={t('dashboard.kpis.unitsSoldHint')}
              tone="success"
              Icon={PillIcon}
            />
            <KpiTile
              label={t('dashboard.kpis.lowStock')}
              value={data.kpis.lowStockCount}
              hint={t('dashboard.kpis.lowStockHint')}
              tone={data.kpis.lowStockCount > 0 ? 'warning' : 'default'}
              Icon={BoxIcon}
            />
            <KpiTile
              label={t('dashboard.kpis.expiring')}
              value={data.kpis.expiringCount}
              hint={t('dashboard.kpis.expiringHint', { value: money(data.kpis.expiringValue) })}
              tone={data.kpis.expiringCount > 0 ? 'danger' : 'default'}
              Icon={CalendarIcon}
            />
          </div>

          {/* Trend + alerts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Trend chart */}
            <section className="panel overflow-hidden lg:col-span-2">
              <header className="border-b border-line px-5 py-4">
                <h2 className="text-sm font-semibold text-ink-primary">
                  {t('dashboard.trend.title')}
                </h2>
                <p className="mt-0.5 text-xs text-ink-secondary">{t('dashboard.trend.subtitle')}</p>
              </header>
              <div className="h-72 px-2 py-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.trend} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={shortDate}
                      stroke="#94A3B8"
                      fontSize={11}
                    />
                    <YAxis
                      stroke="#94A3B8"
                      fontSize={11}
                      tickFormatter={(v) => `$${v}`}
                      width={48}
                    />
                    <Tooltip
                      formatter={(v) => `$${Number(v).toFixed(2)}`}
                      labelFormatter={shortDate}
                      contentStyle={{ borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      name={t('dashboard.trend.revenue')}
                      stroke="#3B82F6"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="cost"
                      name={t('dashboard.trend.cost')}
                      stroke="#F2B900"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      name={t('dashboard.trend.profit')}
                      stroke="#1F8A4C"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Alerts column */}
            <div className="space-y-6">
              <section className="panel overflow-hidden">
                <header className="flex items-center justify-between border-b border-line px-5 py-4">
                  <h2 className="text-sm font-semibold text-ink-primary">
                    {t('dashboard.alerts.expiringTitle')}
                  </h2>
                  <Link to="/inventory/batches" className="text-xs text-brand-chart hover:underline">
                    {t('dashboard.alerts.expiringViewAll')}
                  </Link>
                </header>
                {data.alerts.expiring.length === 0 ? (
                  <div className="px-5 py-6 text-sm text-ink-muted">
                    {t('dashboard.alerts.expiringEmpty')}
                  </div>
                ) : (
                  <ul className="divide-y divide-line">
                    {data.alerts.expiring.map((b) => (
                      <li key={b.batchId} className="px-5 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-ink-primary">
                              {b.medicine}
                            </div>
                            <div className="truncate text-xs text-ink-secondary">
                              {b.branchCode} · #{b.batchNumber} · {b.qtyOnHand} units
                            </div>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              b.daysLeft <= 7
                                ? 'bg-status-danger/15 text-status-danger'
                                : 'bg-status-warning/15 text-status-warning'
                            }`}
                          >
                            {t('dashboard.alerts.daysLeft', { n: b.daysLeft })}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {(user.role === 'OWNER' || user.role === 'MANAGER') && (
                <section className="panel overflow-hidden">
                  <header className="flex items-center justify-between border-b border-line px-5 py-4">
                    <h2 className="text-sm font-semibold text-ink-primary">
                      {t('dashboard.alerts.pendingTitle')}
                    </h2>
                    <Link
                      to="/inventory/purchase-orders"
                      className="text-xs text-brand-chart hover:underline"
                    >
                      {t('dashboard.alerts.pendingViewAll')}
                    </Link>
                  </header>
                  {data.alerts.pendingPos.length === 0 ? (
                    <div className="px-5 py-6 text-sm text-ink-muted">
                      {t('dashboard.alerts.pendingEmpty')}
                    </div>
                  ) : (
                    <ul className="divide-y divide-line">
                      {data.alerts.pendingPos.map((p) => (
                        <li key={p.poId} className="px-5 py-3">
                          <Link
                            to={`/inventory/purchase-orders/${p.poId}`}
                            className="flex items-start justify-between gap-3 hover:text-brand-chart"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-ink-primary">
                                {p.poNumber}
                              </div>
                              <div className="truncate text-xs text-ink-secondary">
                                {p.supplierName} · {p.branchName}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="text-sm font-semibold tabular-nums text-ink-primary">
                                {money(p.totalAmount)}
                              </div>
                              <div className="text-[11px] uppercase tracking-wide text-ink-muted">
                                {p.status}
                              </div>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
