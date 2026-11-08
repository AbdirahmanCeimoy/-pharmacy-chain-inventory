import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext.jsx';
import { listPurchaseOrders } from '../../api/purchase_orders.js';
import DataTable from '../../components/ui/DataTable.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import ExportButtons from '../../components/ui/ExportButtons.jsx';
import { makeExporters } from '../../lib/exporters.js';

const PO_STATUS_LABEL = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted (awaiting HQ)',
  APPROVED: 'Approved',
  PARTIALLY_RECEIVED: 'Partially received',
  RECEIVED: 'Received',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

const PO_STATUS_CLASS = {
  DRAFT: 'bg-ink-muted/20 text-ink-secondary',
  SUBMITTED: 'bg-status-warning/15 text-status-warning',
  APPROVED: 'bg-status-info/15 text-status-info',
  PARTIALLY_RECEIVED: 'bg-brand-primary/15 text-brand-primary',
  RECEIVED: 'bg-status-success/15 text-status-success',
  CLOSED: 'bg-status-success/15 text-status-success',
  CANCELLED: 'bg-status-danger/15 text-status-danger',
};

export default function PurchaseOrdersListPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listPurchaseOrders({ status: statusFilter || undefined }));
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const canCreate = user.role === 'OWNER' || user.role === 'MANAGER';
  const showBranch = user.role === 'OWNER';

  const columns = [
    {
      key: 'poNumber',
      header: t('po.cols.poNumber'),
      sortable: true,
      render: (r) => <span className="font-mono text-xs text-ink-primary">{r.poNumber}</span>,
    },
    ...(showBranch
      ? [
          {
            key: 'branchCode',
            header: t('po.cols.branch'),
            sortable: true,
          },
        ]
      : []),
    { key: 'supplierName', header: t('po.cols.supplier'), sortable: true },
    {
      key: 'status',
      header: t('po.cols.status'),
      sortable: true,
      render: (r) => (
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${PO_STATUS_CLASS[r.status]}`}>
          {PO_STATUS_LABEL[r.status]}
        </span>
      ),
    },
    {
      key: 'totalAmount',
      header: t('po.cols.total'),
      sortable: true,
      align: 'right',
      sortValue: (r) => Number(r.totalAmount),
      render: (r) => <span className="tabular-nums">${Number(r.totalAmount).toFixed(2)}</span>,
    },
    {
      key: 'createdAt',
      header: t('po.cols.created'),
      sortable: true,
      render: (r) => (
        <span className="text-xs text-ink-secondary">
          {new Date(r.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <Link
          to={`/inventory/purchase-orders/${r.id}`}
          className="text-sm font-medium text-brand-primary hover:underline"
        >
          {t('common.view')}
        </Link>
      ),
    },
  ];

  const exporters = makeExporters({
    filenameBase: 'purchase-orders',
    title: t('po.title'),
    columns: [
      { key: 'poNumber', header: t('po.cols.poNumber') },
      ...(showBranch ? [{ key: 'branchCode', header: t('po.cols.branch') }] : []),
      { key: 'supplierName', header: t('po.cols.supplier') },
      { key: 'status', header: t('po.cols.status') },
      { key: 'totalAmount', header: t('po.cols.total') },
      { key: 'createdAt', header: t('po.cols.created') },
    ],
    rows: items,
  });

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'PharmaTrack' }, { label: t('po.title') }]}
        eyebrow={t('nav.inventory')}
        title={t('po.title')}
        subtitle={t('po.subtitle')}
        actions={
          <>
            <ExportButtons {...exporters} disabled={loading || items.length === 0} />
            {canCreate && (
              <Link to="/inventory/purchase-orders/new" className="btn-primary">
                + {t('po.new')}
              </Link>
            )}
          </>
        }
      />

      <div className="panel p-4 sm:p-5">
        <label className="label">{t('po.filterStatus')}</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input w-auto"
        >
          <option value="">{t('po.filterAll')}</option>
          {Object.entries(PO_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
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
          defaultSort={{ key: 'createdAt', dir: 'desc' }}
          pageSize={10}
          loading={loading}
          loadingMessage={t('common.loading')}
          emptyMessage={t('po.empty')}
        />
      </div>
    </div>
  );
}
