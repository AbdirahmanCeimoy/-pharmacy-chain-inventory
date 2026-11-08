import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext.jsx';
import { listBatches, getExpirySummary } from '../../api/batches.js';
import { listBranches } from '../../api/branches.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import ExportButtons from '../../components/ui/ExportButtons.jsx';
import { makeExporters } from '../../lib/exporters.js';

const BUCKETS = [
  { key: 'expired', days: null, label: 'Expired', pill: 'bg-ink-muted/40 text-ink-secondary' },
  { key: 'in30', days: 30, label: '≤ 30 days', pill: 'bg-status-danger/15 text-status-danger' },
  { key: 'in60', days: 60, label: '31–60 days', pill: 'bg-status-warning/15 text-status-warning' },
  {
    key: 'in90',
    days: 90,
    label: '61–90 days',
    pill: 'bg-status-expiry-90/15 text-status-warning',
  },
];

function riskClass(days) {
  if (days == null) return 'bg-ink-muted/40 text-ink-secondary';
  if (days < 0) return 'bg-ink-muted/40 text-ink-secondary';
  if (days <= 30) return 'bg-status-danger/15 text-status-danger';
  if (days <= 60) return 'bg-status-warning/15 text-status-warning';
  if (days <= 90) return 'bg-status-expiry-90/15 text-status-warning';
  return 'bg-status-success/15 text-status-success';
}

export default function BatchesExpiryPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [bucketFilter, setBucketFilter] = useState('');
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user.role !== 'OWNER') return;
    listBranches()
      .then(setBranches)
      .catch(() => {});
  }, [user.role]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (branchId) params.branchId = Number(branchId);
      if (bucketFilter === 'expired') {
        params.includeExpired = 'true';
        params.maxDaysToExpiry = 0;
      } else if (bucketFilter === 'in30') {
        params.maxDaysToExpiry = 30;
        params.includeExpired = 'false';
      } else if (bucketFilter === 'in60') {
        params.maxDaysToExpiry = 60;
        params.includeExpired = 'false';
      } else if (bucketFilter === 'in90') {
        params.maxDaysToExpiry = 90;
        params.includeExpired = 'false';
      }
      const [sum, rows] = await Promise.all([
        getExpirySummary(branchId ? { branchId } : {}),
        listBatches(params),
      ]);
      setSummary(sum);
      setItems(rows);
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [branchId, bucketFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const exporters = makeExporters({
    filenameBase: 'batches',
    title: t('batches.title'),
    columns: [
      { key: 'genericLabel', header: t('batches.cols.medicine') },
      { key: 'batchNumber', header: t('batches.cols.batch') },
      { key: 'branchCode', header: t('batches.cols.branch') },
      { key: 'expiryDate', header: t('batches.cols.expiry') },
      { key: 'qtyOnHand', header: t('batches.cols.qty') },
      { key: 'unitCost', header: t('batches.cols.unitCost') },
      { key: 'stockValue', header: t('batches.cols.stockValue') },
    ],
    rows: items.map((b) => ({
      ...b,
      genericLabel: `${b.medicine.genericName} ${b.medicine.strength} (${b.medicine.brandName})`,
    })),
  });

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'PharmaTrack' }, { label: t('batches.title') }]}
        eyebrow={t('nav.inventory')}
        title={t('batches.title')}
        subtitle={t('batches.subtitle')}
        actions={<ExportButtons {...exporters} disabled={loading || items.length === 0} />}
      />

      {user.role === 'OWNER' && branches.length > 0 && (
        <div className="panel mb-4 p-4 sm:p-5">
          <label className="label">{t('batches.branchFilter')}</label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="input w-auto"
          >
            <option value="">{t('batches.allBranches')}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {BUCKETS.map((b) => {
          const s = summary?.[b.key] ?? { count: 0, qty: 0, value: '0' };
          const active = bucketFilter === b.key;
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => setBucketFilter(active ? '' : b.key)}
              className={`rounded-panel border p-4 text-left transition ${
                active
                  ? 'border-brand-primary bg-brand-primary/5'
                  : 'border-line bg-surface-panel hover:bg-surface-muted'
              }`}
            >
              <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${b.pill}`}>
                {b.label}
              </span>
              <div className="mt-3 text-2xl font-semibold tabular-nums text-ink-primary">
                {s.count}
              </div>
              <div className="text-xs text-ink-secondary">
                {s.qty} {t('batches.units')} · ${Number(s.value).toFixed(2)}
              </div>
            </button>
          );
        })}
      </div>

      <section className="panel mt-4 overflow-hidden">
        <header className="flex items-center justify-between border-b border-line px-6 py-3">
          <h2 className="font-semibold text-ink-primary">
            {bucketFilter
              ? t('batches.filteredHeader', {
                  label: BUCKETS.find((b) => b.key === bucketFilter)?.label,
                })
              : t('batches.allBatchesHeader')}
          </h2>
          <span className="text-xs text-ink-muted">
            {items.length} {t('medicines.resultSuffix')}
          </span>
        </header>
        {error && (
          <div className="border-b border-status-danger/40 bg-status-danger/10 p-3 text-sm text-status-danger">
            {error}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line text-sm">
            <thead className="bg-surface-muted text-xs uppercase tracking-wide text-ink-secondary">
              <tr>
                <th className="px-4 py-2 text-left">{t('batches.cols.medicine')}</th>
                <th className="px-4 py-2 text-left">{t('batches.cols.batch')}</th>
                <th className="px-4 py-2 text-left">{t('batches.cols.branch')}</th>
                <th className="px-4 py-2 text-left">{t('batches.cols.expiry')}</th>
                <th className="px-4 py-2 text-right">{t('batches.cols.qty')}</th>
                <th className="px-4 py-2 text-right">{t('batches.cols.unitCost')}</th>
                <th className="px-4 py-2 text-right">{t('batches.cols.stockValue')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-ink-muted">
                    {t('common.loading')}
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-ink-muted">
                    {t('batches.empty')}
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-primary">
                        {b.medicine.genericName} {b.medicine.strength}
                      </div>
                      <div className="text-xs text-ink-secondary">
                        {b.medicine.brandName} · {b.medicine.form}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{b.batchNumber}</td>
                    <td className="px-4 py-3 text-ink-secondary">{b.branchCode}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${riskClass(b.daysToExpiry)}`}
                      >
                        {b.expiryDate}{' '}
                        {b.daysToExpiry < 0
                          ? `(${Math.abs(b.daysToExpiry)}d ago)`
                          : `(${b.daysToExpiry}d)`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{b.qtyOnHand}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      ${Number(b.unitCost).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      ${Number(b.stockValue).toFixed(2)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
