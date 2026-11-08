import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext.jsx';
import {
  getTransfer,
  approveTransfer,
  dispatchTransfer,
  receiveTransfer,
  cancelTransfer,
} from '../../api/transfers.js';

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

export default function TransferDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [transfer, setTransfer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [receiveQty, setReceiveQty] = useState({}); // transfer_item_id -> qty
  const [shortageNote, setShortageNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const t = await getTransfer(id);
      setTransfer(t);
      const seeded = {};
      for (const it of t.items) seeded[it.id] = String(it.qtyDispatched || '');
      setReceiveQty(seeded);
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(name, fn) {
    setActionError(null);
    setBusy(name);
    try {
      await fn();
      await load();
    } catch (err) {
      setActionError(err?.response?.data?.message || err.message);
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="p-6 text-ink-secondary">{t('common.loading')}</div>;
  if (error) return <div className="panel p-6 text-status-danger">{error}</div>;
  if (!transfer) return null;

  const isOwner = user.role === 'OWNER';
  const isFromBranch = isOwner || Number(user.branchId) === Number(transfer.fromBranchId);
  const isToBranch = isOwner || Number(user.branchId) === Number(transfer.toBranchId);

  const canApprove = transfer.status === 'REQUESTED' && isOwner;
  const canDispatch = transfer.status === 'APPROVED' && isFromBranch;
  const canReceive = transfer.status === 'DISPATCHED' && isToBranch;
  const canCancel =
    ['REQUESTED', 'APPROVED'].includes(transfer.status) && (isFromBranch || isToBranch);

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/transfers')}
        className="text-sm text-ink-secondary hover:text-ink-primary"
      >
        ← {t('transfers.backToList')}
      </button>

      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink-primary sm:text-2xl">
            {transfer.transferNo}
          </h1>
          <p className="mt-1 text-sm text-ink-secondary">
            {transfer.fromBranchName} → {transfer.toBranchName}
          </p>
        </div>
        <span
          className={`inline-flex rounded px-3 py-1 text-xs font-semibold ${STATUS_CLASS[transfer.status]}`}
        >
          {STATUS_LABEL[transfer.status]}
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
          <dt className="text-xs uppercase tracking-wide text-ink-muted">
            {t('transfers.cols.value')}
          </dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-ink-primary">
            ${Number(transfer.totalValue).toFixed(2)}
          </dd>
        </div>
        <div className="rounded-md border border-line bg-surface-muted/60 p-4">
          <dt className="text-xs uppercase tracking-wide text-ink-muted">
            {t('transfers.requestedBy')}
          </dt>
          <dd className="mt-1 text-sm font-medium text-ink-primary">{transfer.requestedByName}</dd>
        </div>
        <div className="rounded-md border border-line bg-surface-muted/60 p-4">
          <dt className="text-xs uppercase tracking-wide text-ink-muted">
            {t('transfers.approvedBy')}
          </dt>
          <dd className="mt-1 text-sm font-medium text-ink-primary">
            {transfer.approvedByName || '-'}
          </dd>
        </div>
        <div className="rounded-md border border-line bg-surface-muted/60 p-4">
          <dt className="text-xs uppercase tracking-wide text-ink-muted">{t('po.cols.created')}</dt>
          <dd className="mt-1 text-sm font-medium text-ink-primary">
            {new Date(transfer.createdAt).toLocaleString()}
          </dd>
        </div>
      </dl>

      {transfer.shortageNote && (
        <p className="mt-4 rounded-md border border-status-warning/40 bg-status-warning/10 p-3 text-sm text-status-warning">
          <span className="font-medium">{t('transfers.shortage')}:</span> {transfer.shortageNote}
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
                <th className="px-4 py-2 text-right">{t('transfers.cols.qtyRequested')}</th>
                <th className="px-4 py-2 text-right">{t('transfers.cols.qtyDispatched')}</th>
                <th className="px-4 py-2 text-left">{t('transfers.cols.destBatch')}</th>
                {canReceive && (
                  <th className="px-4 py-2 text-right">{t('transfers.cols.qtyReceiveNow')}</th>
                )}
                {!canReceive && (
                  <th className="px-4 py-2 text-right">{t('transfers.cols.qtyReceived')}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {transfer.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink-primary">
                      {item.medicine.genericName} {item.medicine.strength}
                    </div>
                    <div className="text-xs text-ink-secondary">
                      {item.medicine.brandName} · {item.medicine.form}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{item.qtyRequested}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{item.qtyDispatched}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {item.destBatchNumber ? (
                      <>
                        {item.destBatchNumber}
                        <div className="text-[10px] text-ink-muted">{item.destExpiryDate}</div>
                      </>
                    ) : (
                      <span className="text-ink-muted">-</span>
                    )}
                  </td>
                  {canReceive ? (
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        max={item.qtyDispatched}
                        className="input w-24 text-right"
                        value={receiveQty[item.id] ?? ''}
                        onChange={(e) =>
                          setReceiveQty((r) => ({ ...r, [item.id]: e.target.value }))
                        }
                      />
                    </td>
                  ) : (
                    <td className="px-4 py-3 text-right tabular-nums">{item.qtyReceived}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {canReceive && (
        <section className="panel mt-4 p-4">
          <label className="block text-sm font-medium text-ink-primary">
            {t('transfers.shortageNote')}
            <input
              type="text"
              className="input mt-1"
              value={shortageNote}
              onChange={(e) => setShortageNote(e.target.value)}
              placeholder={t('transfers.shortagePlaceholder')}
            />
          </label>
        </section>
      )}

      {(canApprove || canDispatch || canReceive || canCancel) && (
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {canCancel && (
            <button
              type="button"
              disabled={busy === 'cancel'}
              onClick={() => run('cancel', () => cancelTransfer(id))}
              className="btn-secondary border-status-danger/40 text-status-danger hover:bg-status-danger/10"
            >
              {busy === 'cancel' ? t('common.loading') : t('transfers.actions.cancel')}
            </button>
          )}
          {canApprove && (
            <button
              type="button"
              disabled={busy === 'approve'}
              onClick={() => run('approve', () => approveTransfer(id))}
              className="btn-primary"
            >
              {busy === 'approve' ? t('common.loading') : t('transfers.actions.approve')}
            </button>
          )}
          {canDispatch && (
            <button
              type="button"
              disabled={busy === 'dispatch'}
              onClick={() => run('dispatch', () => dispatchTransfer(id))}
              className="btn-primary"
            >
              {busy === 'dispatch' ? t('common.loading') : t('transfers.actions.dispatch')}
            </button>
          )}
          {canReceive && (
            <button
              type="button"
              disabled={busy === 'receive'}
              onClick={() =>
                run('receive', () =>
                  receiveTransfer(id, {
                    items: transfer.items.map((it) => ({
                      transfer_item_id: it.id,
                      qty_received: Number(receiveQty[it.id] ?? it.qtyDispatched),
                    })),
                    shortage_note: shortageNote || undefined,
                  })
                )
              }
              className="btn-primary"
            >
              {busy === 'receive' ? t('common.loading') : t('transfers.actions.receive')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
