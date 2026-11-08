import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext.jsx';
import { listStockCounts, startStockCount } from '../../api/stock_counts.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import ExportButtons from '../../components/ui/ExportButtons.jsx';
import { makeExporters } from '../../lib/exporters.js';

const STATUS_LABEL = {
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};
const STATUS_CLASS = {
  IN_PROGRESS: 'bg-status-warning/15 text-status-warning',
  COMPLETED: 'bg-status-success/15 text-status-success',
  CANCELLED: 'bg-ink-muted/30 text-ink-secondary',
};

export default function StockCountsListPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      setItems(await listStockCounts());
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }

  async function onStart() {
    setError(null);
    setStarting(true);
    try {
      const sc = await startStockCount({});
      navigate(`/inventory/stock-counts/${sc.id}`);
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
      setStarting(false);
    }
  }

  const canStart = user.role === 'MANAGER' || user.role === 'OWNER';

  const exporters = makeExporters({
    filenameBase: 'stock-counts',
    title: t('stockCounts.title'),
    columns: [
      { key: 'startedAt', header: t('stockCounts.cols.when') },
      { key: 'branchCode', header: t('stockCounts.cols.branch') },
      { key: 'startedByName', header: t('stockCounts.cols.startedBy') },
      { key: 'status', header: t('stockCounts.cols.status') },
    ],
    rows: items,
  });

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'PharmaTrack' }, { label: t('stockCounts.title') }]}
        eyebrow={t('nav.inventory')}
        title={t('stockCounts.title')}
        subtitle={t('stockCounts.subtitle')}
        actions={
          <>
            <ExportButtons {...exporters} disabled={loading || items.length === 0} />
            {canStart && (
              <button type="button" onClick={onStart} disabled={starting} className="btn-primary">
                {starting ? t('common.loading') : `+ ${t('stockCounts.start')}`}
              </button>
            )}
          </>
        }
      />

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-status-danger/40 bg-status-danger/10 p-3 text-sm text-status-danger"
        >
          {error}
        </div>
      )}

      <section className="panel mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line text-sm">
            <thead className="bg-surface-muted text-xs uppercase tracking-wide text-ink-secondary">
              <tr>
                <th className="px-4 py-2 text-left">{t('stockCounts.cols.when')}</th>
                <th className="px-4 py-2 text-left">{t('stockCounts.cols.branch')}</th>
                <th className="px-4 py-2 text-left">{t('stockCounts.cols.startedBy')}</th>
                <th className="px-4 py-2 text-left">{t('stockCounts.cols.status')}</th>
                <th className="px-4 py-2 text-right">{t('po.cols.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ink-muted">
                    {t('common.loading')}
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ink-muted">
                    {t('stockCounts.empty')}
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((sc) => (
                  <tr key={sc.id}>
                    <td className="px-4 py-3 text-xs text-ink-secondary">
                      {new Date(sc.startedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">{sc.branchCode}</td>
                    <td className="px-4 py-3">{sc.startedByName}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[sc.status]}`}
                      >
                        {STATUS_LABEL[sc.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/inventory/stock-counts/${sc.id}`}
                        className="text-sm font-medium text-brand-primary hover:underline"
                      >
                        {sc.status === 'IN_PROGRESS' ? t('stockCounts.resume') : t('common.view')}
                      </Link>
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
