import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createMedicine } from '../../api/medicines.js';
import Modal from '../../components/ui/Modal.jsx';

const FORMS = ['TABLET', 'SYRUP', 'INJECTION', 'CAPSULE', 'CREAM', 'DROPS', 'OTHER'];

export default function MedicineFormModal({ onClose, onSaved }) {
  const { t } = useTranslation();
  const [data, setData] = useState({
    generic_name: '',
    brand_name: '',
    form: 'TABLET',
    strength: '',
    unit_label: '',
    category: '',
    barcode: '',
    selling_price: '',
    is_controlled: false,
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  function set(k, v) {
    setData((d) => ({ ...d, [k]: v }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await createMedicine({
        ...data,
        selling_price: Number(data.selling_price),
        category: data.category || null,
        barcode: data.barcode || null,
      });
      onSaved();
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('medicines.add')}
      description={t('medicines.subtitle')}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="medicine-form" disabled={busy} className="btn-primary">
            {busy ? t('common.loading') : t('common.save')}
          </button>
        </>
      }
    >
      <form id="medicine-form" onSubmit={onSubmit}>
        {error && (
          <div
            role="alert"
            className="mb-3 rounded-md border border-status-danger/40 bg-status-danger/10 p-2 text-sm text-status-danger"
          >
            {error}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 block text-sm font-medium text-ink-primary">
            {t('medicines.fields.generic')}
            <input
              required
              className="input mt-1"
              placeholder="Enter Generic Name (e.g. Amoxicillin)"
              value={data.generic_name}
              onChange={(e) => set('generic_name', e.target.value)}
            />
          </label>
          <label className="col-span-2 block text-sm font-medium text-ink-primary sm:col-span-1">
            {t('medicines.fields.brand')}
            <input
              required
              className="input mt-1"
              placeholder="Enter Brand Name (e.g. Amoxil)"
              value={data.brand_name}
              onChange={(e) => set('brand_name', e.target.value)}
            />
          </label>
          <label className="col-span-2 block text-sm font-medium text-ink-primary sm:col-span-1">
            {t('medicines.fields.form')}
            <select
              className="input mt-1"
              value={data.form}
              onChange={(e) => set('form', e.target.value)}
            >
              {FORMS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2 block text-sm font-medium text-ink-primary sm:col-span-1">
            {t('medicines.fields.strength')}
            <input
              required
              className="input mt-1"
              placeholder="e.g. 500 mg"
              value={data.strength}
              onChange={(e) => set('strength', e.target.value)}
            />
          </label>
          <label className="col-span-2 block text-sm font-medium text-ink-primary sm:col-span-1">
            {t('medicines.fields.unit')}
            <input
              required
              className="input mt-1"
              placeholder="e.g. Box of 100"
              value={data.unit_label}
              onChange={(e) => set('unit_label', e.target.value)}
            />
          </label>
          <label className="col-span-2 block text-sm font-medium text-ink-primary sm:col-span-1">
            {t('medicines.fields.price')}
            <input
              required
              type="number"
              step="0.01"
              min="0"
              className="input mt-1"
              placeholder="Enter Selling Price"
              value={data.selling_price}
              onChange={(e) => set('selling_price', e.target.value)}
            />
          </label>
          <label className="col-span-2 block text-sm font-medium text-ink-primary sm:col-span-1">
            {t('medicines.fields.category')}
            <input
              className="input mt-1"
              placeholder="e.g. Antibiotic"
              value={data.category}
              onChange={(e) => set('category', e.target.value)}
            />
          </label>
          <label className="col-span-2 block text-sm font-medium text-ink-primary">
            {t('medicines.fields.barcode')}
            <input
              className="input mt-1"
              placeholder="Scan or Enter Barcode"
              value={data.barcode}
              onChange={(e) => set('barcode', e.target.value)}
            />
          </label>
          <label className="col-span-2 flex items-center gap-2 text-sm text-ink-primary">
            <input
              type="checkbox"
              checked={data.is_controlled}
              onChange={(e) => set('is_controlled', e.target.checked)}
              className="h-4 w-4 rounded border-line text-brand-primary focus:ring-brand-primary"
            />
            {t('medicines.fields.controlled')}
          </label>
        </div>
      </form>
    </Modal>
  );
}
