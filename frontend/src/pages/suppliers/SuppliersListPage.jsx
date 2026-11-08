import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext.jsx';
import { listSuppliers } from '../../api/suppliers.js';
import SupplierFormModal from './SupplierFormModal.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import ExportButtons from '../../components/ui/ExportButtons.jsx';
import { makeExporters } from '../../lib/exporters.js';

export default function SuppliersListPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listSuppliers({ q: debouncedQ || undefined, active: activeOnly }));
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, activeOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const canCreate = user.role === 'OWNER';

  const columns = [
    {
      key: 'name',
      header: t('suppliers.cols.name'),
      sortable: true,
      render: (r) => <span className="font-medium text-ink-primary">{r.name}</span>,
    },
    {
      key: 'phone',
      header: t('suppliers.cols.phone'),
      sortable: true,
      render: (r) => r.phone || '-',
    },
    { key: 'address', header: t('suppliers.cols.address'), render: (r) => r.address || '-' },
    {
      key: 'paymentTerms',
      header: t('suppliers.cols.terms'),
      sortable: true,
      render: (r) => r.paymentTerms || '-',
    },
    {
      key: 'flags',
      header: t('medicines.cols.flags'),
      render: (r) =>
        !r.isActive ? (
          <span className="rounded bg-ink-muted/20 px-2 py-0.5 text-xs font-medium text-ink-secondary">
            {t('medicines.flags.inactive')}
          </span>
        ) : null,
    },
  ];

  const exporters = makeExporters({
    filenameBase: 'suppliers',
    title: t('suppliers.title'),
    columns: [
      { key: 'name', header: t('suppliers.cols.name') },
      { key: 'phone', header: t('suppliers.cols.phone') },
      { key: 'address', header: t('suppliers.cols.address') },
      { key: 'paymentTerms', header: t('suppliers.cols.terms') },
    ],
    rows: items,
  });

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'PharmaTrack' }, { label: t('suppliers.title') }]}
        eyebrow={t('nav.inventory')}
        title={t('suppliers.title')}
        subtitle={t('suppliers.subtitle')}
        actions={
          <>
            <ExportButtons {...exporters} disabled={loading || items.length === 0} />
            {canCreate && (
              <button type="button" className="btn-primary" onClick={() => setModal('create')}>
                + {t('suppliers.add')}
              </button>
            )}
          </>
        }
      />

      <div className="panel p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1">
            <label className="label">{t('common.search') || 'Search'}</label>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('suppliers.searchPlaceholder')}
              className="input max-w-md"
            />
          </div>
          <label className="mt-6 flex items-center gap-2 text-sm text-ink-secondary">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="h-4 w-4 rounded border-line text-brand-chart focus:ring-brand-chart"
            />
            {t('medicines.activeOnly')}
          </label>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-status-danger/40 bg-status-danger/10 p-3 text-sm text-status-danger"
        >
          {error}
        </div>
      )}

      <div className="mt-4 panel overflow-hidden">
        <DataTable
          columns={columns}
          data={items}
          defaultSort={{ key: 'name', dir: 'asc' }}
          pageSize={10}
          loading={loading}
          loadingMessage={t('common.loading')}
          emptyMessage={t('suppliers.empty')}
        />
      </div>

      {modal === 'create' && (
        <SupplierFormModal
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}
