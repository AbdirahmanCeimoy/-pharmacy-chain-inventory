import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext.jsx';
import { listMedicines } from '../../api/medicines.js';
import { listBranches } from '../../api/branches.js';
import { createSale } from '../../api/pos.js';

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'EVC_PLUS', label: 'EVC Plus' },
  { value: 'ZAAD', label: 'Zaad' },
  { value: 'E_DAHAB', label: 'eDahab' },
];

export default function PosPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [medicines, setMedicines] = useState([]);
  const [medsLoading, setMedsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]); // [{ medicineId, qty, prescription?: {...} }]
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [customerPhone, setCustomerPhone] = useState('');
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(
    user.role === 'OWNER' ? '' : String(user.branchId ?? '')
  );
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [meds, br] = await Promise.all([
          listMedicines({ active: true, limit: 500 }),
          user.role === 'OWNER' ? listBranches() : Promise.resolve([]),
        ]);
        setMedicines(meds);
        setBranches(br);
      } catch (err) {
        setError(err?.response?.data?.message || err.message);
      } finally {
        setMedsLoading(false);
      }
    })();
  }, [user.role]);

  const medsById = useMemo(() => Object.fromEntries(medicines.map((m) => [m.id, m])), [medicines]);

  const filteredMedicines = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return medicines.slice(0, 20);
    return medicines
      .filter(
        (m) =>
          m.genericName.toLowerCase().includes(q) ||
          m.brandName.toLowerCase().includes(q) ||
          (m.barcode && m.barcode.toLowerCase() === q)
      )
      .slice(0, 20);
  }, [medicines, search]);

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const med = medsById[item.medicineId];
      if (!med) return sum;
      return sum + Number(med.sellingPrice) * Number(item.qty || 0);
    }, 0);
  }, [cart, medsById]);

  function addToCart(med) {
    setCart((c) => {
      const existing = c.find((item) => item.medicineId === med.id);
      if (existing) {
        return c.map((item) =>
          item.medicineId === med.id ? { ...item, qty: Number(item.qty) + 1 } : item
        );
      }
      const newItem = { medicineId: med.id, qty: 1 };
      if (med.isControlled) {
        newItem.prescription = { prescription_number: '', doctor_name: '', patient_name: '' };
      }
      return [...c, newItem];
    });
  }

  function updateCartItem(idx, patch) {
    setCart((c) => c.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  }

  function updatePrescription(idx, patch) {
    setCart((c) =>
      c.map((item, i) =>
        i === idx ? { ...item, prescription: { ...item.prescription, ...patch } } : item
      )
    );
  }

  function removeFromCart(idx) {
    setCart((c) => c.filter((_, i) => i !== idx));
  }

  async function onCheckout() {
    setError(null);
    if (cart.length === 0) {
      setError(t('pos.emptyCart'));
      return;
    }
    const valid = cart.every((item) => {
      if (!item.qty || Number(item.qty) <= 0) return false;
      const med = medsById[item.medicineId];
      if (med?.isControlled) {
        return (
          item.prescription &&
          item.prescription.prescription_number &&
          item.prescription.doctor_name &&
          item.prescription.patient_name
        );
      }
      return true;
    });
    if (!valid) {
      setError(t('pos.invalidCart'));
      return;
    }

    setBusy(true);
    try {
      const sale = await createSale({
        branch_id: branchId ? Number(branchId) : undefined,
        payment_method: paymentMethod,
        customer_phone: customerPhone || undefined,
        items: cart.map((item) => ({
          medicine_id: item.medicineId,
          qty: Number(item.qty),
          prescription: item.prescription,
        })),
      });
      navigate(`/pos/receipts/${sale.id}`);
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  }

  const canCheckout = branchId && cart.length > 0 && !busy;

  return (
    <div>
      <div>
        <h1 className="text-xl font-semibold text-ink-primary sm:text-2xl">{t('pos.title')}</h1>
        <p className="mt-1 text-sm text-ink-secondary">{t('pos.subtitle')}</p>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-3 rounded-md border border-status-danger/40 bg-status-danger/10 p-3 text-sm text-status-danger"
        >
          {error}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* LEFT: product search + list */}
        <section className="panel lg:col-span-2">
          <header className="border-b border-line p-4">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('pos.searchPlaceholder')}
              className="input"
              autoFocus
            />
          </header>
          <div className="max-h-[520px] overflow-y-auto">
            {medsLoading && <p className="p-6 text-center text-ink-muted">{t('common.loading')}</p>}
            {!medsLoading && filteredMedicines.length === 0 && (
              <p className="p-6 text-center text-ink-muted">{t('pos.noMatches')}</p>
            )}
            <ul className="divide-y divide-line">
              {filteredMedicines.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-ink-primary">
                        {m.genericName} {m.strength}
                      </span>
                      {m.isControlled && (
                        <span className="rounded bg-status-warning/15 px-1.5 py-0.5 text-[10px] font-medium uppercase text-status-warning">
                          {t('medicines.flags.controlled')}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-ink-secondary">
                      {m.brandName} · {m.form} · {m.unitLabel}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="tabular-nums text-ink-secondary">
                      ${Number(m.sellingPrice).toFixed(2)}
                    </span>
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={() => addToCart(m)}
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* RIGHT: cart + payment */}
        <section className="panel flex flex-col">
          <header className="border-b border-line p-4">
            <h2 className="font-semibold text-ink-primary">{t('pos.cart')}</h2>
            <p className="mt-1 text-xs text-ink-muted">{t('pos.cartHint')}</p>
          </header>

          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 && (
              <p className="p-6 text-center text-sm text-ink-muted">{t('pos.emptyHint')}</p>
            )}
            {cart.map((item, idx) => {
              const med = medsById[item.medicineId];
              if (!med) return null;
              return (
                <div key={idx} className="space-y-2 border-b border-line p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink-primary">
                        {med.genericName} {med.strength}
                      </div>
                      <div className="truncate text-xs text-ink-secondary">{med.brandName}</div>
                    </div>
                    <button
                      type="button"
                      aria-label={t('pos.remove')}
                      onClick={() => removeFromCart(idx)}
                      className="text-ink-muted hover:text-status-danger"
                    >
                      ×
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      className="input w-20 text-right"
                      value={item.qty}
                      onChange={(e) => updateCartItem(idx, { qty: e.target.value })}
                    />
                    <span className="text-xs text-ink-muted">×</span>
                    <span className="text-xs tabular-nums text-ink-secondary">
                      ${Number(med.sellingPrice).toFixed(2)}
                    </span>
                    <span className="ml-auto text-sm font-medium tabular-nums text-ink-primary">
                      ${(Number(med.sellingPrice) * Number(item.qty || 0)).toFixed(2)}
                    </span>
                  </div>

                  {med.isControlled && (
                    <div className="mt-2 rounded-md border border-status-warning/30 bg-status-warning/5 p-2">
                      <p className="text-xs font-medium text-status-warning">
                        {t('pos.prescriptionRequired')}
                      </p>
                      <div className="mt-2 grid grid-cols-1 gap-2">
                        <input
                          type="text"
                          placeholder={t('pos.rxNumber')}
                          className="input text-xs"
                          value={item.prescription?.prescription_number || ''}
                          onChange={(e) =>
                            updatePrescription(idx, { prescription_number: e.target.value })
                          }
                        />
                        <input
                          type="text"
                          placeholder={t('pos.rxDoctor')}
                          className="input text-xs"
                          value={item.prescription?.doctor_name || ''}
                          onChange={(e) => updatePrescription(idx, { doctor_name: e.target.value })}
                        />
                        <input
                          type="text"
                          placeholder={t('pos.rxPatient')}
                          className="input text-xs"
                          value={item.prescription?.patient_name || ''}
                          onChange={(e) =>
                            updatePrescription(idx, { patient_name: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="space-y-3 border-t border-line p-4">
            <div className="flex items-center justify-between text-base font-semibold">
              <span>{t('pos.total')}</span>
              <span className="tabular-nums">${subtotal.toFixed(2)}</span>
            </div>

            {user.role === 'OWNER' && (
              <label className="block text-xs font-medium text-ink-secondary">
                {t('po.fields.branch')}
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="input mt-1 text-sm"
                >
                  <option value="">{t('po.chooseBranch')}</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div>
              <div className="text-xs font-medium text-ink-secondary">{t('pos.payment')}</div>
              <div className="mt-1 grid grid-cols-2 gap-1">
                {PAYMENT_METHODS.map((pm) => (
                  <button
                    key={pm.value}
                    type="button"
                    onClick={() => setPaymentMethod(pm.value)}
                    className={
                      paymentMethod === pm.value
                        ? 'rounded-md border border-brand-primary bg-brand-primary/10 px-2 py-1.5 text-xs font-medium text-brand-primary'
                        : 'rounded-md border border-line bg-surface-panel px-2 py-1.5 text-xs text-ink-secondary hover:bg-surface-muted'
                    }
                  >
                    {pm.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="block text-xs font-medium text-ink-secondary">
              {t('pos.customerPhone')}
              <input
                type="tel"
                className="input mt-1 text-sm"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+252-..."
              />
            </label>

            <button
              type="button"
              onClick={onCheckout}
              disabled={!canCheckout}
              className="btn-primary w-full"
            >
              {busy ? t('common.loading') : t('pos.completeSale')}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
