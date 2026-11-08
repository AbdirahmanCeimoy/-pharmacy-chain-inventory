import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext.jsx';
import { listTransfers } from '../../api/transfers.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import ExportButtons from '../../components/ui/ExportButtons.jsx';
import { makeExporters } from '../../lib/exporters.js';

const STATUS_LABEL = {
  REQUESTED: 'Requested (awaiting HQ)',
  APPROVED: 'Approved',
  DISPATCHED: 'In transit',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
};
const STATUS_CLASS = {
  REQUESTED: 'bg-status-warning/15 text-status-warning',
  APPROVED: 'bg-status-info/15 text-status-info',
  DISPATCHED: 'bg-brand-primary/15 text-brand-primary',
  RECEIVED: 'bg-status-success/15 text-status-success',
  CANCELLED: 'bg-status-danger/15 text-status-danger',
};

export default function TransfersListPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listTransfers({ status: status || undefined }));
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const canCreate = user.role === 'MANAGER' || user.role === 'OWNER';

  const exporters = makeExporters({
    filenameBase: 'transfers',
    title: t('transfers.title'),
    columns: [
      { key: 'transferNo', header: t('transfers.cols.transferNo') },
      { key: 'fromBranchCode', header: t('transfers.cols.from') },
      { key: 'toBranchCode', header: t('transfers.cols.to') },
      { key: 'status', header: t('transfers.cols.status') },
      { key: 'totalValue', header: t('transfers.cols.value') },
      { key: 'createdAt', header: t('po.cols.created') },
    ],
    rows: items,
  });

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'PharmaTrack' }, { label: t('transfers.title') }]}
        eyebrow={t('nav.transfers')}
        title={t('transfers.title')}
        subtitle={t('transfers.subtitle')}
        actions={
          <>
            <ExportButtons {...exporters} disabled={loading || items.length === 0} />
            {canCreate && (
              <Link to="/transfers/new" className="btn-primary">
                + {t('transfers.new')}
              </Link>
            )}
          </>
        }
      />

      <div className="panel mb-4 p-4 sm:p-5">
        <label className="label">{t('po.filterStatus')}</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="input w-auto"
        >
          <option value="">{t('po.filterAll')}</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <span className="ml-3 text-xs text-ink-muted">
          {items.length} {t('medicines.resultSuffix')}
        </span>
      </div>

      <section className="panel mt-4 overflow-hidden">
        {error && (
          <div className="border-b border-status-danger/40 bg-status-danger/10 p-3 text-sm text-status-danger">
            {error}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line text-sm">
            <thead className="bg-surface-muted text-xs uppercase tracking-wide text-ink-secondary">
              <tr>
                <th className="px-4 py-2 text-left">{t('transfers.cols.transferNo')}</th>
                <th className="px-4 py-2 text-left">{t('transfers.cols.from')}</th>
                <th className="px-4 py-2 text-left">{t('transfers.cols.to')}</th>
                <th className="px-4 py-2 text-left">{t('transfers.cols.status')}</th>
                <th className="px-4 py-2 text-right">{t('transfers.cols.value')}</th>
                <th className="px-4 py-2 text-left">{t('po.cols.created')}</th>
                <th className="px-4 py-2 text-right">{t('po.cols.actions')}</th>
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
                    {t('transfers.empty')}
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-3 font-mono text-xs text-ink-primary">{t.transferNo}</td>
                    <td className="px-4 py-3">{t.fromBranchCode}</td>
                    <td className="px-4 py-3">{t.toBranchCode}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[t.status]}`}
                      >
                        {STATUS_LABEL[t.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      ${Number(t.totalValue).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-secondary">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/transfers/${t.id}`}
                        className="text-sm font-medium text-brand-primary hover:underline"
                      >
                        {t.status === 'DISPATCHED' ? 'Receive' : 'View'}
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
