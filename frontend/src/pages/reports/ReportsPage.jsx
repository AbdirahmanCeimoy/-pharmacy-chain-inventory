import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useAuth } from '../../auth/AuthContext.jsx';
import { listBranches } from '../../api/branches.js';
import { getProfit, getExpiryLoss } from '../../api/reports.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import ExportButtons from '../../components/ui/ExportButtons.jsx';
import { makeExporters } from '../../lib/exporters.js';

function startOfTodayStr(offsetDays = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(
    user.role === 'OWNER' ? '' : String(user.branchId ?? '')
  );
  const [from, setFrom] = useState(startOfTodayStr(-30));
  const [to, setTo] = useState(startOfTodayStr(0));
  const [profit, setProfit] = useState(null);
  const [expiry, setExpiry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user.role === 'OWNER')
      listBranches()
        .then(setBranches)
        .catch(() => {});
  }, [user.role]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = { from, to };
        if (branchId) params.branchId = Number(branchId);
        const [p, e] = await Promise.all([getProfit(params), getExpiryLoss(params)]);
        setProfit(p);
        setExpiry(e);
      } catch (err) {
        setError(err?.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [from, to, branchId]);

  // Group profit rows by period (sum across branches if OWNER + no branchId).
  const profitChartData = useMemo(() => {
    if (!profit?.rows?.length) return [];
    const byPeriod = new Map();
    for (const r of profit.rows) {
      const existing = byPeriod.get(r.period) || {
        period: r.period,
        revenue: 0,
        cost: 0,
        profit: 0,
      };
      existing.revenue += r.revenue;
      existing.cost += r.cost;
      existing.profit += r.profit;
      byPeriod.set(r.period, existing);
    }
    return [...byPeriod.values()].map((r) => ({
      ...r,
      revenue: Number(r.revenue.toFixed(2)),
      cost: Number(r.cost.toFixed(2)),
      profit: Number(r.profit.toFixed(2)),
    }));
  }, [profit]);

  const expiryChartData = useMemo(() => {
    if (!expiry?.monthly?.length) return [];
    const byMonth = new Map();
    for (const m of expiry.monthly) {
      const existing = byMonth.get(m.month) || { month: m.month, lossValue: 0 };
      existing.lossValue += m.lossValue;
      byMonth.set(m.month, existing);
    }
    return [...byMonth.values()]
      .map((m) => ({ ...m, lossValue: Number(m.lossValue.toFixed(2)) }))
      .sort((a, b) => (a.month > b.month ? 1 : -1));
  }, [expiry]);

  const profitExporters = makeExporters({
    filenameBase: 'profit-report',
    title: t('reports.title'),
    columns: [
      { key: 'period', header: 'Period' },
      { key: 'revenue', header: t('dashboard.trend.revenue') },
      { key: 'cost', header: t('dashboard.trend.cost') },
      { key: 'profit', header: t('dashboard.trend.profit') },
    ],
    rows: profitChartData,
  });

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'PharmaTrack' }, { label: t('reports.title') }]}
        eyebrow={t('nav.reports')}
        title={t('reports.title')}
        subtitle={t('reports.subtitle')}
        actions={
          <ExportButtons
            {...profitExporters}
            disabled={loading || profitChartData.length === 0}
          />
        }
      />

      <section className="panel mt-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          {user.role === 'OWNER' && (
            <label className="text-sm text-ink-secondary">
              {t('batches.branchFilter')}
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="input mt-1 w-auto"
              >
                <option value="">{t('batches.allBranches')}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="text-sm text-ink-secondary">
            {t('reports.from')}
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="input mt-1"
            />
          </label>
          <label className="text-sm text-ink-secondary">
            {t('reports.to')}
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="input mt-1"
            />
          </label>
        </div>
      </section>

      {error && (
        <div className="mt-4 rounded-md border border-status-danger/40 bg-status-danger/10 p-3 text-sm text-status-danger">
          {error}
        </div>
      )}

      {/* PROFIT */}
      <section className="panel mt-4">
        <header className="flex items-center justify-between border-b border-line px-6 py-3">
          <div>
            <h2 className="font-semibold text-ink-primary">{t('reports.profit.title')}</h2>
            <p className="text-xs text-ink-muted">{t('reports.profit.hint')}</p>
          </div>
          {profit && (
            <div className="text-right text-sm">
              <div className="text-xs uppercase text-ink-muted">{t('reports.profit.total')}</div>
              <div className="font-semibold tabular-nums text-ink-primary">
                ${profit.totals.profit.toFixed(2)}
              </div>
              <div className="text-xs text-ink-secondary">
                Rev ${profit.totals.revenue.toFixed(2)} · Cost ${profit.totals.cost.toFixed(2)}
              </div>
            </div>
          )}
        </header>
        <div className="p-4" style={{ height: 320 }}>
          {loading && <p className="p-6 text-center text-ink-muted">{t('common.loading')}</p>}
          {!loading && profitChartData.length === 0 && (
            <p className="p-6 text-center text-ink-muted">{t('reports.profit.empty')}</p>
          )}
          {!loading && profitChartData.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={profitChartData}>
                <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
                <XAxis dataKey="period" stroke="#64748B" fontSize={12} />
                <YAxis stroke="#64748B" fontSize={12} />
                <Tooltip
                  formatter={(v) => `$${Number(v).toFixed(2)}`}
                  labelStyle={{ color: '#0F172A' }}
                  contentStyle={{ borderColor: '#E5E7EB' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={false}
                />
                <Line type="monotone" dataKey="cost" stroke="#F2B900" strokeWidth={2} dot={false} />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="#1F8A4C"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* EXPIRY LOSS */}
      <section className="panel mt-4">
        <header className="flex items-center justify-between border-b border-line px-6 py-3">
          <div>
            <h2 className="font-semibold text-ink-primary">{t('reports.loss.title')}</h2>
            <p className="text-xs text-ink-muted">{t('reports.loss.hint')}</p>
          </div>
          {expiry && (
            <div className="text-right text-sm">
              <div className="text-xs uppercase text-ink-muted">{t('reports.loss.total')}</div>
              <div className="font-semibold tabular-nums text-status-danger">
                ${expiry.total.value.toFixed(2)}
              </div>
              <div className="text-xs text-ink-secondary">
                {expiry.total.qty} {t('batches.units')}
              </div>
            </div>
          )}
        </header>
        <div className="p-4" style={{ height: 300 }}>
          {loading && <p className="p-6 text-center text-ink-muted">{t('common.loading')}</p>}
          {!loading && expiryChartData.length === 0 && (
            <p className="p-6 text-center text-ink-muted">{t('reports.loss.empty')}</p>
          )}
          {!loading && expiryChartData.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expiryChartData}>
                <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
                <XAxis dataKey="month" stroke="#64748B" fontSize={12} />
                <YAxis stroke="#64748B" fontSize={12} />
                <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
                <Bar dataKey="lossValue" fill="#EF4444" name={t('reports.loss.title')} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* TOP MEDICINES LOST */}
      {expiry?.top10?.length > 0 && (
        <section className="panel mt-4 overflow-hidden">
          <header className="border-b border-line px-6 py-3">
            <h2 className="font-semibold text-ink-primary">{t('reports.loss.top10')}</h2>
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-line text-sm">
              <thead className="bg-surface-muted text-xs uppercase tracking-wide text-ink-secondary">
                <tr>
                  <th className="px-4 py-2 text-left">{t('po.cols.medicine')}</th>
                  <th className="px-4 py-2 text-right">{t('batches.cols.qty')}</th>
                  <th className="px-4 py-2 text-right">{t('reports.loss.value')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {expiry.top10.map((m) => (
                  <tr key={m.medicineId}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-primary">
                        {m.genericName} {m.strength}
                      </div>
                      <div className="text-xs text-ink-secondary">
                        {m.brandName} · {m.form}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{m.lossQty}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-status-danger">
                      ${m.lossValue.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
