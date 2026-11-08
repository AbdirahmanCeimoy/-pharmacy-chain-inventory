import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getPurchaseOrder, receivePurchaseOrder } from '../../api/purchase_orders.js';

function todayPlus(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysUntil(iso) {
  if (!iso) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = new Date(iso + 'T00:00:00');
  return Math.floor((t.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function PurchaseOrderReceivePage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState({}); // po_item_id -> { qty, batch_number, expiry_date, actual_unit_cost }
  const [allowShort, setAllowShort] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const po = await getPurchaseOrder(id);
        setPo(po);
        // Seed one row per PO item with defaults.
        const seeded = {};
        for (const it of po.items) {
          seeded[it.id] = {
            qty: '',
            batch_number: '',
            expiry_date: todayPlus(365),
            actual_unit_cost: it.expectedUnitCost,
          };
        }
        setRows(seeded);
      } catch (err) {
        setError(err?.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const needsShortWarn = useMemo(
    () => Object.values(rows).some((r) => r.expiry_date && daysUntil(r.expiry_date) < 90),
    [rows]
  );

  const payloadItems = useMemo(
    () =>
      Object.entries(rows)
        .filter(([, v]) => Number(v.qty) > 0 && v.batch_number && v.expiry_date)
        .map(([po_item_id, v]) => ({
          po_item_id: Number(po_item_id),
          qty: Number(v.qty),
          batch_number: v.batch_number.trim(),
          expiry_date: v.expiry_date,
          actual_unit_cost: Number(v.actual_unit_cost),
        })),
    [rows]
  );

  function setRow(poItemId, patch) {
    setRows((r) => ({ ...r, [poItemId]: { ...r[poItemId], ...patch } }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!payloadItems.length) {
      setError(t('receive.noLines'));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await receivePurchaseOrder(id, {
        allow_short_expiry: allowShort,
        items: payloadItems,
      });
      navigate(`/inventory/purchase-orders/${id}`);
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6 text-ink-secondary">{t('common.loading')}</div>;
  if (!po) return <div className="p-6 text-status-danger">{error}</div>;

  const canReceive = ['APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status);

  return (
    <div>
      <Link
        to={`/inventory/purchase-orders/${id}`}
        className="text-sm text-ink-secondary hover:text-ink-primary"
      >
        ← {t('po.backToList')}
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-ink-primary sm:text-2xl">
        {t('receive.title')}: {po.poNumber}
      </h1>
      <p className="mt-1 text-sm text-ink-secondary">
        {po.supplierName} · {po.branchName} · {t('po.cols.status')}:{' '}
        <span className="font-medium text-ink-primary">{po.status}</span>
      </p>

      {!canReceive && (
        <div className="mt-4 rounded-md border border-status-warning/40 bg-status-warning/10 p-3 text-sm text-status-warning">
          {t('receive.notReceivable', { status: po.status })}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-status-danger/40 bg-status-danger/10 p-3 text-sm text-status-danger"
        >
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="panel mt-4 overflow-hidden">
        <header className="border-b border-line px-6 py-4">
          <h2 className="font-semibold text-ink-primary">{t('receive.itemsHeader')}</h2>
          <p className="mt-1 text-xs text-ink-muted">{t('receive.rulesLine')}</p>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line text-sm">
            <thead className="bg-surface-muted text-xs uppercase tracking-wide text-ink-secondary">
              <tr>
                <th className="px-4 py-2 text-left">{t('po.cols.medicine')}</th>
                <th className="px-4 py-2 text-right">{t('po.cols.qty')}</th>
                <th className="px-4 py-2 text-right">{t('po.cols.qtyReceived')}</th>
                <th className="px-4 py-2 text-right">{t('receive.cols.qtyNow')}</th>
                <th className="px-4 py-2 text-left">{t('receive.cols.batch')}</th>
                <th className="px-4 py-2 text-left">{t('receive.cols.expiry')}</th>
                <th className="px-4 py-2 text-right">{t('receive.cols.actualCost')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {po.items.map((item) => {
                const row = rows[item.id] || {};
                const remaining = Math.floor(item.qtyOrdered * 1.1) - item.qtyReceived;
                const shortExpiry = row.expiry_date && daysUntil(row.expiry_date) < 90;
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-primary">
                        {item.medicine.genericName} {item.medicine.strength}
                      </div>
                      <div className="text-xs text-ink-secondary">
                        {item.medicine.brandName} · {item.medicine.form}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{item.qtyOrdered}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-secondary">
                      {item.qtyReceived}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        max={Math.max(0, remaining)}
                        step="1"
                        className="input text-right"
                        value={row.qty}
                        onChange={(e) => setRow(item.id, { qty: e.target.value })}
                        disabled={!canReceive || remaining <= 0}
                        placeholder={remaining <= 0 ? '-' : String(remaining)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        className="input"
                        value={row.batch_number}
                        onChange={(e) => setRow(item.id, { batch_number: e.target.value })}
                        disabled={!canReceive || remaining <= 0}
                        placeholder="LOT-..."
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="date"
                        className="input"
                        value={row.expiry_date}
                        onChange={(e) => setRow(item.id, { expiry_date: e.target.value })}
                        disabled={!canReceive || remaining <= 0}
                      />
                      {shortExpiry && (
                        <div className="mt-1 text-xs text-status-warning">
                          {t('receive.shortExpiryWarn', { days: daysUntil(row.expiry_date) })}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="input text-right"
                        value={row.actual_unit_cost}
                        onChange={(e) => setRow(item.id, { actual_unit_cost: e.target.value })}
                        disabled={!canReceive || remaining <= 0}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {needsShortWarn && (
          <div className="border-t border-line bg-status-warning/10 px-6 py-3">
            <label className="flex items-center gap-2 text-sm text-status-warning">
              <input
                type="checkbox"
                checked={allowShort}
                onChange={(e) => setAllowShort(e.target.checked)}
                className="h-4 w-4 rounded border-line text-status-warning focus:ring-status-warning"
              />
              {t('receive.allowShortExpiryLabel')}
            </label>
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">
          <button
            type="button"
            onClick={() => navigate(`/inventory/purchase-orders/${id}`)}
            className="btn-secondary"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={!canReceive || busy || payloadItems.length === 0}
            className="btn-primary"
          >
            {busy ? t('common.loading') : t('receive.submit')}
          </button>
        </div>
      </form>
    </div>
  );
}
