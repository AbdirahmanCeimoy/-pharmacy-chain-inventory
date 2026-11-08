import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext.jsx';
import { listBranches } from '../../api/branches.js';
import { getReorderSuggestions } from '../../api/reorder.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import ExportButtons from '../../components/ui/ExportButtons.jsx';
import { makeExporters } from '../../lib/exporters.js';

function coverClass(days) {
  if (days == null) return 'bg-ink-muted/20 text-ink-secondary';
  if (days < 3) return 'bg-status-danger/15 text-status-danger';
  if (days < 7) return 'bg-status-warning/15 text-status-warning';
  return 'bg-status-info/15 text-status-info';
}

export default function ReorderPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(
    user.role === 'OWNER' ? '' : String(user.branchId ?? '')
  );
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user.role !== 'OWNER') return;
    listBranches()
      .then(setBranches)
      .catch(() => {});
  }, [user.role]);

  const load = useCallback(async () => {
    if (!branchId) {
      setResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setResult(await getReorderSuggestions({ branchId: Number(branchId) }));
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    load();
  }, [load]);

  const exporters = makeExporters({
    filenameBase: 'reorder-suggestions',
    title: t('reorder.title'),
    columns: [
      { key: 'genericLabel', header: t('po.cols.medicine') },
      { key: 'currentStock', header: t('reorder.cols.currentStock') },
      { key: 'avgDaily', header: t('reorder.cols.avgDaily') },
      { key: 'daysCover', header: t('reorder.cols.daysCover') },
      { key: 'suggestedQty', header: t('reorder.cols.suggestedQty') },
      { key: 'suggestedCost', header: t('reorder.cols.estCost') },
    ],
    rows: (result?.items ?? []).map((r) => ({
      ...r,
      genericLabel: `${r.medicine.genericName} ${r.medicine.strength} (${r.medicine.brandName})`,
    })),
  });

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'PharmaTrack' }, { label: t('reorder.title') }]}
        eyebrow={t('nav.inventory')}
        title={t('reorder.title')}
        subtitle={t('reorder.subtitle')}
        actions={
          <ExportButtons
            {...exporters}
            disabled={loading || !result || result.items.length === 0}
          />
        }
      />

      {user.role === 'OWNER' && (
        <div className="panel mb-4 p-4 sm:p-5">
          <label className="label">{t('batches.branchFilter')}</label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="input w-auto"
          >
            <option value="">{t('po.chooseBranch')}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-md border border-status-danger/40 bg-status-danger/10 p-3 text-sm text-status-danger">
          {error}
        </div>
      )}

      <section className="panel mt-4 overflow-hidden">
        <header className="flex items-center justify-between border-b border-line px-6 py-3">
          <h2 className="font-semibold text-ink-primary">{t('reorder.listHeader')}</h2>
          {result && (
            <span className="text-xs text-ink-muted">
              {result.items.length} {t('medicines.resultSuffix')}
            </span>
          )}
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line text-sm">
            <thead className="bg-surface-muted text-xs uppercase tracking-wide text-ink-secondary">
              <tr>
                <th className="px-4 py-2 text-left">{t('po.cols.medicine')}</th>
                <th className="px-4 py-2 text-right">{t('reorder.cols.currentStock')}</th>
                <th className="px-4 py-2 text-right">{t('reorder.cols.avgDaily')}</th>
                <th className="px-4 py-2 text-right">{t('reorder.cols.daysCover')}</th>
                <th className="px-4 py-2 text-right">{t('reorder.cols.suggestedQty')}</th>
                <th className="px-4 py-2 text-right">{t('reorder.cols.estCost')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-ink-muted">
                    {t('common.loading')}
                  </td>
                </tr>
              )}
              {!loading && !branchId && user.role === 'OWNER' && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-ink-muted">
                    {t('reorder.pickBranch')}
                  </td>
                </tr>
              )}
              {!loading && result && result.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-ink-muted">
                    {t('reorder.empty')}
                  </td>
                </tr>
              )}
              {!loading &&
                result?.items.map((r) => (
                  <tr key={r.medicineId}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-primary">
                        {r.medicine.genericName} {r.medicine.strength}
                      </div>
                      <div className="text-xs text-ink-secondary">
                        {r.medicine.brandName} · {r.medicine.form} · {r.medicine.unitLabel}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.currentStock}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.avgDaily.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${coverClass(r.daysCover)}`}
                      >
                        {r.daysCover == null ? '-' : `${r.daysCover.toFixed(1)}d`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-brand-primary">
                      {r.suggestedQty}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      ${r.suggestedCost.toFixed(2)}
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
