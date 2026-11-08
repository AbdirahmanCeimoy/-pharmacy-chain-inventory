import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext.jsx';
import { listMedicines } from '../../api/medicines.js';
import MedicineFormModal from './MedicineFormModal.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import ExportButtons from '../../components/ui/ExportButtons.jsx';
import { makeExporters } from '../../lib/exporters.js';

const FORM_LABEL = {
  TABLET: 'Tablet',
  SYRUP: 'Syrup',
  INJECTION: 'Injection',
  CAPSULE: 'Capsule',
  CREAM: 'Cream',
  DROPS: 'Drops',
  OTHER: 'Other',
};

export default function MedicinesListPage() {
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
      setItems(await listMedicines({ q: debouncedQ || undefined, active: activeOnly }));
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
      key: 'genericName',
      header: t('medicines.cols.generic'),
      sortable: true,
      render: (row) => <span className="font-medium text-ink-primary">{row.genericName}</span>,
    },
    { key: 'brandName', header: t('medicines.cols.brand'), sortable: true },
    {
      key: 'form',
      header: t('medicines.cols.form'),
      sortable: true,
      render: (row) => FORM_LABEL[row.form] ?? row.form,
    },
    { key: 'strength', header: t('medicines.cols.strength'), sortable: true },
    { key: 'unitLabel', header: t('medicines.cols.unit') },
    {
      key: 'sellingPrice',
      header: t('medicines.cols.price'),
      sortable: true,
      align: 'right',
      sortValue: (r) => Number(r.sellingPrice),
      render: (r) => <span className="tabular-nums">${Number(r.sellingPrice).toFixed(2)}</span>,
    },
    {
      key: 'flags',
      header: t('medicines.cols.flags'),
      render: (r) => (
        <div className="flex flex-wrap items-center gap-1">
          {r.isControlled && (
            <span className="rounded bg-status-warning/15 px-2 py-0.5 text-xs font-medium text-status-warning">
              {t('medicines.flags.controlled')}
            </span>
          )}
          {!r.isActive && (
            <span className="rounded bg-ink-muted/20 px-2 py-0.5 text-xs font-medium text-ink-secondary">
              {t('medicines.flags.inactive')}
            </span>
          )}
        </div>
      ),
    },
  ];

  const exporters = makeExporters({
    filenameBase: 'medicines',
    title: t('medicines.title'),
    columns: [
      { key: 'genericName', header: t('medicines.cols.generic') },
      { key: 'brandName', header: t('medicines.cols.brand') },
      { key: 'form', header: t('medicines.cols.form') },
      { key: 'strength', header: t('medicines.cols.strength') },
      { key: 'unitLabel', header: t('medicines.cols.unit') },
      { key: 'sellingPrice', header: t('medicines.cols.price') },
    ],
    rows: items,
  });

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'PharmaTrack' }, { label: t('medicines.title') }]}
        eyebrow={t('nav.inventory')}
        title={t('medicines.title')}
        subtitle={t('medicines.subtitle')}
        actions={
          <>
            <ExportButtons {...exporters} disabled={loading || items.length === 0} />
            {canCreate && (
              <button type="button" className="btn-primary" onClick={() => setModal('create')}>
                + {t('medicines.add')}
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
              placeholder={t('medicines.searchPlaceholder')}
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
          defaultSort={{ key: 'genericName', dir: 'asc' }}
          pageSize={10}
          loading={loading}
          loadingMessage={t('common.loading')}
          emptyMessage={t('medicines.empty')}
          rowClassName={(r) => (r.isActive ? '' : 'bg-surface-muted/50 text-ink-muted')}
        />
      </div>

      {modal === 'create' && (
        <MedicineFormModal
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
