import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext.jsx';
import { listSuppliers } from '../../api/suppliers.js';
import { listMedicines } from '../../api/medicines.js';
import { listBranches } from '../../api/branches.js';
import { createPurchaseOrder, submitPurchaseOrder } from '../../api/purchase_orders.js';

const HQ_THRESHOLD = 1000;

function emptyItem() {
  return { medicine_id: '', qty_ordered: '', expected_unit_cost: '' };
}

export default function PurchaseOrderCreatePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [suppliers, setSuppliers] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [branches, setBranches] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [branchId, setBranchId] = useState(
    user.role === 'OWNER' ? '' : String(user.branchId ?? '')
  );
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([emptyItem()]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // 'draft' | 'submit' | null

  useEffect(() => {
    (async () => {
      try {
        const [s, m, b] = await Promise.all([
          listSuppliers({ active: true }),
          listMedicines({ active: true, limit: 500 }),
          user.role === 'OWNER' ? listBranches() : Promise.resolve([]),
        ]);
        setSuppliers(s);
        setMedicines(m);
        setBranches(b);
      } catch (err) {
        setError(err?.response?.data?.message || err.message);
      }
    })();
  }, [user.role]);

  const total = useMemo(
    () =>
      items.reduce(
        (sum, i) => sum + (Number(i.qty_ordered) || 0) * (Number(i.expected_unit_cost) || 0),
        0
      ),
    [items]
  );

  const needsHQ = total > HQ_THRESHOLD;

  function setItem(idx, patch) {
    setItems((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setItems((rows) => [...rows, emptyItem()]);
  }

  function removeRow(idx) {
    setItems((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== idx)));
  }

  function onMedicineChange(idx, medId) {
    const med = medicines.find((m) => String(m.id) === String(medId));
    // Pre-fill expected_unit_cost from the medicine's selling price as a starting point.
    setItem(idx, {
      medicine_id: medId,
      expected_unit_cost: med ? med.sellingPrice : '',
    });
  }

  async function save(submitAfter) {
    setError(null);
    setBusy(submitAfter ? 'submit' : 'draft');
    try {
      const payload = {
        supplier_id: Number(supplierId),
        branch_id: branchId ? Number(branchId) : undefined,
        notes: notes || undefined,
        items: items
          .filter((i) => i.medicine_id && i.qty_ordered && i.expected_unit_cost)
          .map((i) => ({
            medicine_id: Number(i.medicine_id),
            qty_ordered: Number(i.qty_ordered),
            expected_unit_cost: Number(i.expected_unit_cost),
          })),
      };
      const po = await createPurchaseOrder(payload);
      if (submitAfter) {
        await submitPurchaseOrder(po.id);
      }
      navigate(`/inventory/purchase-orders/${po.id}`);
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
      setBusy(null);
    }
  }

  const valid =
    supplierId &&
    branchId &&
    items.some(
      (i) => i.medicine_id && Number(i.qty_ordered) > 0 && Number(i.expected_unit_cost) > 0
    );

  return (
    <div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/inventory/purchase-orders')}
          className="text-sm text-ink-secondary hover:text-ink-primary"
        >
          ← {t('po.backToList')}
        </button>
      </div>
      <h1 className="mt-2 text-xl font-semibold text-ink-primary sm:text-2xl">{t('po.new')}</h1>
      <p className="mt-1 text-sm text-ink-secondary">
        {t('po.createSubtitle', { branch: user.role === 'OWNER' ? 'All' : `#${user.branchId}` })}
      </p>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-status-danger/40 bg-status-danger/10 p-3 text-sm text-status-danger"
        >
          {error}
        </div>
      )}

      <section className="panel mt-4 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {user.role === 'OWNER' ? (
            <label className="block text-sm font-medium text-ink-primary">
              {t('po.fields.branch')}
              <select
                className="input mt-1"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                required
              >
                <option value="">{t('po.chooseBranch')}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div>
              <div className="text-sm font-medium text-ink-primary">{t('po.fields.branch')}</div>
              <div className="input mt-1 bg-surface-muted">#{user.branchId}</div>
            </div>
          )}
          <label className="block text-sm font-medium text-ink-primary">
            {t('po.fields.supplier')}
            <select
              className="input mt-1"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              required
            >
              <option value="">{t('po.chooseSupplier')}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.paymentTerms ? `(${s.paymentTerms})` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-ink-primary">
            {t('po.fields.notes')}
            <input
              className="input mt-1"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
            />
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
                <th className="w-[45%] px-4 py-2 text-left">{t('po.cols.medicine')}</th>
                <th className="w-[15%] px-4 py-2 text-right">{t('po.cols.qty')}</th>
                <th className="w-[20%] px-4 py-2 text-right">{t('po.cols.unitCost')}</th>
                <th className="w-[15%] px-4 py-2 text-right">{t('po.cols.lineTotal')}</th>
                <th className="w-[5%] px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((item, idx) => {
                const line =
                  (Number(item.qty_ordered) || 0) * (Number(item.expected_unit_cost) || 0);
                return (
                  <tr key={idx}>
                    <td className="px-4 py-2">
                      <select
                        className="input"
                        value={item.medicine_id}
                        onChange={(e) => onMedicineChange(idx, e.target.value)}
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
                        value={item.qty_ordered}
                        onChange={(e) => setItem(idx, { qty_ordered: e.target.value })}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="input text-right"
                        value={item.expected_unit_cost}
                        onChange={(e) => setItem(idx, { expected_unit_cost: e.target.value })}
                      />
                    </td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums">
                      ${line.toFixed(2)}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        disabled={items.length === 1}
                        className="text-xs text-ink-muted hover:text-status-danger disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={t('po.removeRow')}
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
                <td colSpan={3} className="px-4 py-3 text-right font-medium text-ink-secondary">
                  {t('po.cols.total')}
                </td>
                <td className="px-4 py-3 text-right text-base font-semibold tabular-nums text-ink-primary">
                  ${total.toFixed(2)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        {needsHQ && (
          <div className="border-t border-line bg-status-warning/10 px-6 py-3 text-sm text-status-warning">
            {t('po.needsHqNotice', { threshold: HQ_THRESHOLD })}
          </div>
        )}
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => navigate('/inventory/purchase-orders')}
          className="btn-secondary"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          disabled={!valid || busy}
          onClick={() => save(false)}
          className="btn-secondary"
        >
          {busy === 'draft' ? t('common.loading') : t('po.saveDraft')}
        </button>
        <button
          type="button"
          disabled={!valid || busy}
          onClick={() => save(true)}
          className="btn-primary"
        >
          {busy === 'submit' ? t('common.loading') : t('po.saveAndSubmit')}
        </button>
      </div>
    </div>
  );
}
