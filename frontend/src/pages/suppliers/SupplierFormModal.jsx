import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createSupplier } from '../../api/suppliers.js';
import Modal from '../../components/ui/Modal.jsx';

export default function SupplierFormModal({ onClose, onSaved }) {
  const { t } = useTranslation();
  const [data, setData] = useState({ name: '', phone: '', address: '', payment_terms: '' });
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
      await createSupplier({
        name: data.name.trim(),
        phone: data.phone.trim() || null,
        address: data.address.trim() || null,
        payment_terms: data.payment_terms.trim() || null,
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
      title={t('suppliers.add')}
      description={t('suppliers.subtitle')}
      maxWidth="max-w-md"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="supplier-form" disabled={busy} className="btn-primary">
            {busy ? t('common.loading') : t('common.save')}
          </button>
        </>
      }
    >
      <form id="supplier-form" onSubmit={onSubmit} className="space-y-3">
        {error && (
          <div
            role="alert"
            className="rounded-md border border-status-danger/40 bg-status-danger/10 p-2 text-sm text-status-danger"
          >
            {error}
          </div>
        )}
        <label className="block text-sm font-medium text-ink-primary">
          {t('suppliers.fields.name')}
          <input
            required
            className="input mt-1"
            placeholder="Enter Supplier Name"
            value={data.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </label>
        <label className="block text-sm font-medium text-ink-primary">
          {t('suppliers.fields.phone')}
          <input
            className="input mt-1"
            placeholder="+252-..."
            value={data.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
        </label>
        <label className="block text-sm font-medium text-ink-primary">
          {t('suppliers.fields.address')}
          <input
            className="input mt-1"
            placeholder="Enter Address"
            value={data.address}
            onChange={(e) => set('address', e.target.value)}
          />
        </label>
        <label className="block text-sm font-medium text-ink-primary">
          {t('suppliers.fields.paymentTerms')}
          <input
            className="input mt-1"
            placeholder="NET 30 / NET 15 / COD"
            value={data.payment_terms}
            onChange={(e) => set('payment_terms', e.target.value)}
          />
        </label>
      </form>
    </Modal>
  );
}
