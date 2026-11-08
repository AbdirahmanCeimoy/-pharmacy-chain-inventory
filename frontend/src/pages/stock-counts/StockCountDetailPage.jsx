import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext.jsx';
import { getStockCount, submitStockCount, cancelStockCount } from '../../api/stock_counts.js';

const REASONS = ['DAMAGED', 'LOST', 'COUNTING_ERROR', 'THEFT', 'EXPIRED', 'OTHER'];

export default function StockCountDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [count, setCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [rows, setRows] = useState({}); // item_id -> { physical, reason, note }
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sc = await getStockCount(id);
      setCount(sc);
      const seeded = {};
      for (const it of sc.items) {
        seeded[it.id] = {
          physical: String(it.physicalQty ?? it.systemQty),
          reason: it.reason || 'OTHER',
          note: it.note || '',
        };
      }
      setRows(seeded);
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => {
    if (!count) return { diffCount: 0, adjustmentValue: 0 };
    let diffCount = 0;
    let adjustmentValue = 0;
    for (const it of count.items) {
      const row = rows[it.id];
      if (!row) continue;
      const adj = Number(row.physical) - it.systemQty;
      if (adj !== 0) {
        diffCount++;
        adjustmentValue += adj * Number(it.unitCost);
      }
    }
    return { diffCount, adjustmentValue };
  }, [count, rows]);

  const canEdit =
    count?.status === 'IN_PROGRESS' && (user.role === 'MANAGER' || user.role === 'OWNER');

  async function onSubmit() {
    setActionError(null);
    setBusy('submit');
    try {
      const items = count.items.map((it) => {
        const row = rows[it.id];
        const physical = Number(row?.physical ?? it.systemQty);
        const payload = { stock_count_item_id: it.id, physical_qty: physical };
        if (physical !== it.systemQty) {
          payload.reason = row?.reason || 'OTHER';
          if (row?.note) payload.note = row.note;
        }
        return payload;
      });
      await submitStockCount(id, { items });
      await load();
    } catch (err) {
      setActionError(err?.response?.data?.message || err.message);
    } finally {
      setBusy(null);
    }
  }

  async function onCancel() {
    setActionError(null);
    setBusy('cancel');
    try {
      await cancelStockCount(id);
      await load();
    } catch (err) {
      setActionError(err?.response?.data?.message || err.message);
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="p-6 text-ink-secondary">{t('common.loading')}</div>;
  if (error)
    return (
      <div className="panel p-6 text-status-danger">
        {error}
        <div className="mt-3">
          <Link to="/inventory/stock-counts" className="btn-secondary text-sm">
            ← {t('stockCounts.backToList')}
          </Link>
        </div>
      </div>
    );
  if (!count) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/inventory/stock-counts')}
        className="text-sm text-ink-secondary hover:text-ink-primary"
      >
        ← {t('stockCounts.backToList')}
      </button>

      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink-primary sm:text-2xl">
            {t('stockCounts.detailTitle', { id: count.id })}
          </h1>
          <p className="mt-1 text-sm text-ink-secondary">
            {count.branchName} · {new Date(count.startedAt).toLocaleString()} ·{' '}
            {count.startedByName}
          </p>
        </div>
        <span
          className={`inline-flex rounded px-3 py-1 text-xs font-semibold ${
            count.status === 'IN_PROGRESS'
              ? 'bg-status-warning/15 text-status-warning'
              : count.status === 'COMPLETED'
                ? 'bg-status-success/15 text-status-success'
                : 'bg-ink-muted/30 text-ink-secondary'
          }`}
        >
          {count.status}
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

      {canEdit && (
        <div className="mt-4 rounded-md border border-status-warning/40 bg-status-warning/10 p-3 text-sm text-status-warning">
          {t('stockCounts.salesBlockedNotice')}
        </div>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-md border border-line bg-surface-muted/60 p-4">
          <dt className="text-xs uppercase tracking-wide text-ink-muted">
            {t('stockCounts.cols.batches')}
          </dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-ink-primary">
            {count.items.length}
          </dd>
        </div>
        <div className="rounded-md border border-line bg-surface-muted/60 p-4">
          <dt className="text-xs uppercase tracking-wide text-ink-muted">
            {t('stockCounts.cols.discrepancies')}
          </dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-ink-primary">
            {summary.diffCount}
          </dd>
        </div>
        <div className="rounded-md border border-line bg-surface-muted/60 p-4">
          <dt className="text-xs uppercase tracking-wide text-ink-muted">
            {t('stockCounts.cols.netValue')}
          </dt>
          <dd
            className={`mt-1 text-lg font-semibold tabular-nums ${
              summary.adjustmentValue < 0 ? 'text-status-danger' : 'text-status-success'
            }`}
          >
            ${summary.adjustmentValue.toFixed(2)}
          </dd>
        </div>
      </dl>

      <section className="panel mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line text-sm">
            <thead className="bg-surface-muted text-xs uppercase tracking-wide text-ink-secondary">
              <tr>
                <th className="px-4 py-2 text-left">{t('po.cols.medicine')}</th>
                <th className="px-4 py-2 text-left">{t('batches.cols.batch')}</th>
                <th className="px-4 py-2 text-right">{t('stockCounts.cols.system')}</th>
                <th className="px-4 py-2 text-right">{t('stockCounts.cols.physical')}</th>
                <th className="px-4 py-2 text-right">{t('stockCounts.cols.diff')}</th>
                <th className="px-4 py-2 text-left">{t('stockCounts.cols.reason')}</th>
                <th className="px-4 py-2 text-left">{t('stockCounts.cols.note')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {count.items.map((it) => {
                const row = rows[it.id] || {};
                const physical = Number(row.physical ?? it.systemQty);
                const diff = physical - it.systemQty;
                const diffClass =
                  diff === 0
                    ? 'text-ink-muted'
                    : diff < 0
                      ? 'text-status-danger'
                      : 'text-status-success';
                return (
                  <tr key={it.id}>
                    <td className="px-4 py-2">
                      <div className="font-medium text-ink-primary">
                        {it.medicine.genericName} {it.medicine.strength}
                      </div>
                      <div className="text-xs text-ink-secondary">
                        {it.medicine.brandName} · {it.medicine.form}
                      </div>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {it.batchNumber}
                      <div className="text-[10px] text-ink-muted">{it.expiryDate}</div>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{it.systemQty}</td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="0"
                        className="input w-24 text-right"
                        value={row.physical ?? ''}
                        onChange={(e) =>
                          setRows((r) => ({
                            ...r,
                            [it.id]: { ...r[it.id], physical: e.target.value },
                          }))
                        }
                        disabled={!canEdit}
                      />
                    </td>
                    <td className={`px-4 py-2 text-right tabular-nums font-medium ${diffClass}`}>
                      {diff === 0 ? '-' : diff > 0 ? `+${diff}` : diff}
                    </td>
                    <td className="px-4 py-2">
                      <select
                        className="input"
                        disabled={!canEdit || diff === 0}
                        value={row.reason ?? 'OTHER'}
                        onChange={(e) =>
                          setRows((r) => ({
                            ...r,
                            [it.id]: { ...r[it.id], reason: e.target.value },
                          }))
                        }
                      >
                        {REASONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        className="input"
                        disabled={!canEdit}
                        placeholder="-"
                        value={row.note ?? ''}
                        onChange={(e) =>
                          setRows((r) => ({
                            ...r,
                            [it.id]: { ...r[it.id], note: e.target.value },
                          }))
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {canEdit && (
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy === 'cancel'}
            className="btn-secondary border-status-danger/40 text-status-danger hover:bg-status-danger/10"
          >
            {busy === 'cancel' ? t('common.loading') : t('stockCounts.actions.cancel')}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy === 'submit'}
            className="btn-primary"
          >
            {busy === 'submit' ? t('common.loading') : t('stockCounts.actions.submit')}
          </button>
        </div>
      )}
    </div>
  );
}
