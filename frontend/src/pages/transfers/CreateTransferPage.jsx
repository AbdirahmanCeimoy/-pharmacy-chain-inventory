import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext.jsx';
import { listBranches } from '../../api/branches.js';
import { listMedicines } from '../../api/medicines.js';
import { createTransfer } from '../../api/transfers.js';

const HQ_THRESHOLD = 500;

function emptyItem() {
  return { medicine_id: '', qty_requested: '' };
}

export default function CreateTransferPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [branches, setBranches] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [fromBranchId, setFromBranchId] = useState('');
  const [toBranchId, setToBranchId] = useState(
    user.role === 'OWNER' ? '' : String(user.branchId ?? '')
  );
  const [items, setItems] = useState([emptyItem()]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [b, m] = await Promise.all([
          listBranches(),
          listMedicines({ active: true, limit: 500 }),
        ]);
        setBranches(b);
        setMedicines(m);
      } catch (err) {
        setError(err?.response?.data?.message || err.message);
      }
    })();
  }, []);

  const medsById = useMemo(() => Object.fromEntries(medicines.map((m) => [m.id, m])), [medicines]);

  const estimatedValue = useMemo(
    () =>
      items.reduce((sum, i) => {
        const med = medsById[Number(i.medicine_id)];
        if (!med) return sum;
        return sum + Number(med.sellingPrice) * (Number(i.qty_requested) || 0);
      }, 0),
    [items, medsById]
  );
  const needsHQ = estimatedValue > HQ_THRESHOLD;

  function setItem(idx, patch) {
    setItems((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setItems((r) => [...r, emptyItem()]);
  }
  function removeRow(idx) {
    setItems((r) => (r.length <= 1 ? r : r.filter((_, i) => i !== idx)));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!fromBranchId || !toBranchId) {
      setError(t('transfers.chooseBothBranches'));
      return;
    }
    if (fromBranchId === toBranchId) {
      setError(t('transfers.sameBranch'));
      return;
    }
    const payloadItems = items
      .filter((i) => i.medicine_id && Number(i.qty_requested) > 0)
      .map((i) => ({
        medicine_id: Number(i.medicine_id),
        qty_requested: Number(i.qty_requested),
      }));
    if (!payloadItems.length) {
      setError(t('transfers.needItems'));
      return;
    }
    setBusy(true);
    try {
      const transfer = await createTransfer({
        from_branch_id: Number(fromBranchId),
        to_branch_id: Number(toBranchId),
        items: payloadItems,
      });
      navigate(`/transfers/${transfer.id}`);
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/transfers')}
        className="text-sm text-ink-secondary hover:text-ink-primary"
      >
        ← {t('transfers.backToList')}
      </button>
      <h1 className="mt-2 text-xl font-semibold text-ink-primary sm:text-2xl">
        {t('transfers.new')}
      </h1>
      <p className="mt-1 text-sm text-ink-secondary">{t('transfers.createHint')}</p>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-status-danger/40 bg-status-danger/10 p-3 text-sm text-status-danger"
        >
          {error}
        </div>
      )}

      <form onSubmit={onSubmit}>
        <section className="panel mt-4 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-ink-primary">
              {t('transfers.fields.from')}
              <select
                className="input mt-1"
                value={fromBranchId}
                onChange={(e) => setFromBranchId(e.target.value)}
                required
              >
                <option value="">{t('transfers.chooseBranch')}</option>
                {branches
                  .filter((b) => String(b.id) !== String(toBranchId))
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-ink-primary">
              {t('transfers.fields.to')}
              {user.role === 'OWNER' ? (
                <select
                  className="input mt-1"
                  value={toBranchId}
                  onChange={(e) => setToBranchId(e.target.value)}
                  required
                >
                  <option value="">{t('transfers.chooseBranch')}</option>
                  {branches
                    .filter((b) => String(b.id) !== String(fromBranchId))
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                </select>
              ) : (
                <div className="input mt-1 bg-surface-muted">#{user.branchId}</div>
              )}
            </label>
          </div>
        </section>

        <section className="panel mt-4 overflow-hidden">
          <header className="flex items-center justify-between border-b border-line px-6 py-4">
            <h2 className="font-semibold text-ink-primary">{t('po.fields.items')}</h2>
            <button type="button" onClick={addRow} className="btn-secondary text-xs">
              + {t('po.addRow')}
            </button>
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-line text-sm">
              <thead className="bg-surface-muted text-xs uppercase tracking-wide text-ink-secondary">
                <tr>
                  <th className="w-[65%] px-4 py-2 text-left">{t('po.cols.medicine')}</th>
                  <th className="w-[20%] px-4 py-2 text-right">{t('po.cols.qty')}</th>
                  <th className="w-[15%] px-4 py-2 text-right">{t('transfers.cols.value')}</th>
                  <th className="w-[5%] px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((item, idx) => {
                  const med = medsById[Number(item.medicine_id)];
                  const value = med
                    ? Number(med.sellingPrice) * (Number(item.qty_requested) || 0)
                    : 0;
                  return (
                    <tr key={idx}>
                      <td className="px-4 py-2">
                        <select
                          className="input"
                          value={item.medicine_id}
                          onChange={(e) => setItem(idx, { medicine_id: e.target.value })}
                        >
                          <option value="">{t('po.chooseMedicine')}</option>
                          {medicines.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.genericName} {m.strength} {m.form} ({m.brandName}) · $
                              {Number(m.sellingPrice).toFixed(2)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min="1"
                          className="input text-right"
                          value={item.qty_requested}
                          onChange={(e) => setItem(idx, { qty_requested: e.target.value })}
                        />
                      </td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums">
                        ${value.toFixed(2)}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          disabled={items.length === 1}
                          className="text-xs text-ink-muted hover:text-status-danger disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-surface-muted/60">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-right font-medium text-ink-secondary">
                    {t('transfers.cols.value')}
                  </td>
                  <td className="px-4 py-3 text-right text-base font-semibold tabular-nums text-ink-primary">
                    ${estimatedValue.toFixed(2)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          {needsHQ && (
            <div className="border-t border-line bg-status-warning/10 px-6 py-3 text-sm text-status-warning">
              {t('transfers.needsHqNotice', { threshold: HQ_THRESHOLD })}
            </div>
          )}
        </section>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => navigate('/transfers')} className="btn-secondary">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? t('common.loading') : t('transfers.create')}
          </button>
        </div>
      </form>
    </div>
  );
}
