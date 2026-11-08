import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext.jsx';
import { getSaleByReceipt } from '../../api/pos.js';
import { createReturn, listReturns } from '../../api/returns.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import ExportButtons from '../../components/ui/ExportButtons.jsx';
import { makeExporters } from '../../lib/exporters.js';

export default function ReturnsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [recent, setRecent] = useState([]);
  const [receiptNo, setReceiptNo] = useState('');
  const [sale, setSale] = useState(null);
  const [rows, setRows] = useState({}); // sale_item_id -> qty to return
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const canCreate = user.role === 'MANAGER' || user.role === 'OWNER';

  useEffect(() => {
    listReturns({ limit: 10 })
      .then(setRecent)
      .catch(() => {});
  }, []);

  async function lookup() {
    setError(null);
    setSale(null);
    if (!receiptNo.trim()) return;
    try {
      const s = await getSaleByReceipt(receiptNo.trim(), {
        branchId: user.role === 'OWNER' ? undefined : undefined, // uses actor's branch by default
      });
      setSale(s);
      const seeded = {};
      for (const it of s.items) seeded[it.id] = '';
      setRows(seeded);
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!canCreate) {
      setError(t('returns.noPermission'));
      return;
    }
    const items = Object.entries(rows)
      .filter(([, v]) => Number(v) > 0)
      .map(([k, v]) => ({ sale_item_id: Number(k), qty: Number(v) }));
    if (!items.length) {
      setError(t('returns.pickAtLeastOne'));
      return;
    }
    if (!reason.trim()) {
      setError(t('returns.reasonRequired'));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const created = await createReturn({
        receipt_no: sale.receiptNo,
        reason: reason.trim(),
        items,
      });
      setSale(null);
      setReceiptNo('');
      setRows({});
      setReason('');
      const updated = await listReturns({ limit: 10 });
      setRecent(updated);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      alert(`Return #${created.id} recorded. Refund: $${Number(created.refundAmount).toFixed(2)}`);
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  }

  const recentExporters = makeExporters({
    filenameBase: 'returns',
    title: t('returns.recent'),
    columns: [
      { key: 'createdAt', header: t('returns.cols.when') },
      { key: 'receiptNo', header: t('returns.cols.receipt') },
      { key: 'branchCode', header: t('returns.cols.branch') },
      { key: 'approvedByName', header: t('returns.cols.approvedBy') },
      { key: 'reason', header: t('returns.cols.reason') },
      { key: 'refundAmount', header: t('returns.cols.refund') },
    ],
    rows: recent,
  });

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'PharmaTrack' }, { label: t('returns.title') }]}
        eyebrow={t('nav.pos')}
        title={t('returns.title')}
        subtitle={t('returns.subtitle')}
        actions={<ExportButtons {...recentExporters} disabled={recent.length === 0} />}
      />

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-status-danger/40 bg-status-danger/10 p-3 text-sm text-status-danger"
        >
          {error}
        </div>
      )}

      <section className="panel mt-4 p-6">
        <h2 className="font-semibold text-ink-primary">{t('returns.lookupTitle')}</h2>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="flex-1 text-sm font-medium text-ink-primary">
            {t('returns.receipt')}
            <input
              type="text"
              className="input mt-1 font-mono"
              placeholder="MOG-01-000064"
              value={receiptNo}
              onChange={(e) => setReceiptNo(e.target.value.toUpperCase())}
            />
          </label>
          <button type="button" onClick={lookup} className="btn-secondary">
            {t('returns.lookup')}
          </button>
        </div>
      </section>

      {sale && (
        <form onSubmit={submit} className="panel mt-4 overflow-hidden">
          <header className="border-b border-line p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-mono text-sm text-ink-primary">{sale.receiptNo}</h2>
                <p className="text-xs text-ink-secondary">
                  {sale.branchName} · {new Date(sale.createdAt).toLocaleString()} ·{' '}
                  {sale.cashierName}
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums">
                ${Number(sale.total).toFixed(2)}
              </span>
            </div>
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-line text-sm">
              <thead className="bg-surface-muted text-xs uppercase tracking-wide text-ink-secondary">
                <tr>
                  <th className="px-4 py-2 text-left">{t('po.cols.medicine')}</th>
                  <th className="px-4 py-2 text-right">{t('returns.cols.sold')}</th>
                  <th className="px-4 py-2 text-right">{t('returns.cols.price')}</th>
                  <th className="px-4 py-2 text-right">{t('returns.cols.returnQty')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sale.items.map((item) => (
                  <tr
                    key={item.id}
                    className={item.medicine.isControlled ? 'bg-status-warning/5' : ''}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-primary">
                        {item.medicine.genericName} {item.medicine.strength}
                      </div>
                      <div className="text-xs text-ink-secondary">
                        {item.medicine.brandName}
                        {item.medicine.isControlled && (
                          <span className="ml-2 rounded bg-status-warning/15 px-1.5 py-0.5 text-[10px] font-medium uppercase text-status-warning">
                            {t('medicines.flags.controlled')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{item.qty}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      ${Number(item.unitPrice).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        max={item.qty}
                        className="input w-20 text-right"
                        value={rows[item.id] ?? ''}
                        onChange={(e) => setRows((r) => ({ ...r, [item.id]: e.target.value }))}
                        disabled={item.medicine.isControlled}
                        placeholder={item.medicine.isControlled ? '-' : String(item.qty)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 border-t border-line p-4">
            <label className="block text-sm font-medium text-ink-primary">
              {t('returns.reason')}
              <input
                type="text"
                required
                className="input mt-1"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('returns.reasonPlaceholder')}
              />
            </label>
            <div className="flex justify-end">
              <button type="submit" disabled={!canCreate || busy} className="btn-primary">
                {busy ? t('common.loading') : t('returns.record')}
              </button>
            </div>
          </div>
        </form>
      )}

      <section className="panel mt-6 overflow-hidden">
        <header className="border-b border-line px-6 py-3">
          <h2 className="font-semibold text-ink-primary">{t('returns.recent')}</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line text-sm">
            <thead className="bg-surface-muted text-xs uppercase tracking-wide text-ink-secondary">
              <tr>
                <th className="px-4 py-2 text-left">{t('returns.cols.when')}</th>
                <th className="px-4 py-2 text-left">{t('returns.cols.receipt')}</th>
                <th className="px-4 py-2 text-left">{t('returns.cols.branch')}</th>
                <th className="px-4 py-2 text-left">{t('returns.cols.approvedBy')}</th>
                <th className="px-4 py-2 text-left">{t('returns.cols.reason')}</th>
                <th className="px-4 py-2 text-right">{t('returns.cols.refund')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {recent.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-ink-muted">
                    {t('returns.empty')}
                  </td>
                </tr>
              )}
              {recent.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-xs text-ink-secondary">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-primary">{r.receiptNo}</td>
                  <td className="px-4 py-3">{r.branchCode}</td>
                  <td className="px-4 py-3">{r.approvedByName}</td>
                  <td className="px-4 py-3 text-ink-secondary">{r.reason}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    ${Number(r.refundAmount).toFixed(2)}
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
