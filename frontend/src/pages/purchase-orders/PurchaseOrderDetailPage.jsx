import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext.jsx';
import {
  getPurchaseOrder,
  submitPurchaseOrder,
  approvePurchaseOrder,
  cancelPurchaseOrder,
} from '../../api/purchase_orders.js';

const STATUS_LABEL = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted (awaiting HQ)',
  APPROVED: 'Approved',
  PARTIALLY_RECEIVED: 'Partially received',
  RECEIVED: 'Received',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};
const STATUS_CLASS = {
  DRAFT: 'bg-ink-muted/20 text-ink-secondary',
  SUBMITTED: 'bg-status-warning/15 text-status-warning',
  APPROVED: 'bg-status-info/15 text-status-info',
  PARTIALLY_RECEIVED: 'bg-brand-primary/15 text-brand-primary',
  RECEIVED: 'bg-status-success/15 text-status-success',
  CLOSED: 'bg-status-success/15 text-status-success',
  CANCELLED: 'bg-status-danger/15 text-status-danger',
};

export default function PurchaseOrderDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPo(await getPurchaseOrder(id));
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(fn, name) {
    setActionError(null);
    setBusy(name);
    try {
      await fn(id);
      await load();
    } catch (err) {
      setActionError(err?.response?.data?.message || err.message);
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <div className="p-6 text-ink-secondary">{t('common.loading')}</div>;
  }
  if (error) {
    return (
      <div className="panel p-6 text-status-danger">
        {error}
        <div className="mt-3">
          <Link to="/inventory/purchase-orders" className="btn-secondary text-sm">
            ← {t('po.backToList')}
          </Link>
        </div>
      </div>
    );
  }
  if (!po) return null;

  const canSubmit = po.status === 'DRAFT' && (user.role === 'OWNER' || user.role === 'MANAGER');
  const canApprove = po.status === 'SUBMITTED' && user.role === 'OWNER';
  const canReceive =
    ['APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status) &&
    (user.role === 'OWNER' || user.role === 'MANAGER');
  const canCancel =
    ['DRAFT', 'SUBMITTED', 'APPROVED'].includes(po.status) &&
    (user.role === 'OWNER' || user.role === 'MANAGER');

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/inventory/purchase-orders')}
        className="text-sm text-ink-secondary hover:text-ink-primary"
      >
        ← {t('po.backToList')}
      </button>

      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink-primary sm:text-2xl">{po.poNumber}</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            {po.supplierName} · {po.branchName}
          </p>
        </div>
        <span
          className={`inline-flex rounded px-3 py-1 text-xs font-semibold ${STATUS_CLASS[po.status]}`}
        >
          {STATUS_LABEL[po.status]}
        </span>
      </div>

      {actionError && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-status-danger/40 bg-status-danger/10 p-3 text-sm text-status-danger"
        >
          {actionError}
        </div>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-md border border-line bg-surface-muted/60 p-4">
          <dt className="text-xs uppercase tracking-wide text-ink-muted">{t('po.cols.total')}</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-ink-primary">
            ${Number(po.totalAmount).toFixed(2)}
          </dd>
        </div>
        <div className="rounded-md border border-line bg-surface-muted/60 p-4">
          <dt className="text-xs uppercase tracking-wide text-ink-muted">{t('po.createdBy')}</dt>
          <dd className="mt-1 text-sm font-medium text-ink-primary">{po.createdByName}</dd>
        </div>
        <div className="rounded-md border border-line bg-surface-muted/60 p-4">
          <dt className="text-xs uppercase tracking-wide text-ink-muted">{t('po.approvedBy')}</dt>
          <dd className="mt-1 text-sm font-medium text-ink-primary">{po.approvedByName || '-'}</dd>
        </div>
        <div className="rounded-md border border-line bg-surface-muted/60 p-4">
          <dt className="text-xs uppercase tracking-wide text-ink-muted">{t('po.cols.created')}</dt>
          <dd className="mt-1 text-sm font-medium text-ink-primary">
            {new Date(po.createdAt).toLocaleString()}
          </dd>
        </div>
      </dl>

      {po.notes && (
        <p className="mt-4 rounded-md border border-line bg-surface-muted/40 p-3 text-sm text-ink-secondary">
          <span className="font-medium text-ink-primary">{t('po.fields.notes')}:</span> {po.notes}
        </p>
      )}

      <section className="panel mt-6 overflow-hidden">
        <header className="border-b border-line px-6 py-4">
          <h2 className="font-semibold text-ink-primary">{t('po.fields.items')}</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line text-sm">
            <thead className="bg-surface-muted text-xs uppercase tracking-wide text-ink-secondary">
              <tr>
                <th className="px-4 py-2 text-left">{t('po.cols.medicine')}</th>
                <th className="px-4 py-2 text-right">{t('po.cols.qty')}</th>
                <th className="px-4 py-2 text-right">{t('po.cols.qtyReceived')}</th>
                <th className="px-4 py-2 text-right">{t('po.cols.unitCost')}</th>
                <th className="px-4 py-2 text-right">{t('po.cols.lineTotal')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {po.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink-primary">
                      {item.medicine.genericName} {item.medicine.strength}
                    </div>
                    <div className="text-xs text-ink-secondary">
                      {item.medicine.brandName} · {item.medicine.form} · {item.medicine.unitLabel}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{item.qtyOrdered}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-secondary">
                    {item.qtyReceived}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    ${Number(item.expectedUnitCost).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    ${Number(item.lineTotal).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {(canSubmit || canApprove || canReceive || canCancel) && (
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {canCancel && (
            <button
              type="button"
              disabled={busy === 'cancel'}
              onClick={() => run(cancelPurchaseOrder, 'cancel')}
              className="btn-secondary border-status-danger/40 text-status-danger hover:bg-status-danger/10"
            >
              {busy === 'cancel' ? t('common.loading') : t('po.actions.cancel')}
            </button>
          )}
          {canSubmit && (
            <button
              type="button"
              disabled={busy === 'submit'}
              onClick={() => run(submitPurchaseOrder, 'submit')}
              className="btn-primary"
            >
              {busy === 'submit' ? t('common.loading') : t('po.actions.submit')}
            </button>
          )}
          {canApprove && (
            <button
              type="button"
              disabled={busy === 'approve'}
              onClick={() => run(approvePurchaseOrder, 'approve')}
              className="btn-primary"
            >
              {busy === 'approve' ? t('common.loading') : t('po.actions.approve')}
            </button>
          )}
          {canReceive && (
            <Link to={`/inventory/purchase-orders/${po.id}/receive`} className="btn-primary">
              {t('po.actions.receive')}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
