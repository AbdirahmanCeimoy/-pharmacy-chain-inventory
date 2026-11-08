import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getSale } from '../../api/pos.js';
import { downloadReceiptPdf } from '../../lib/receiptPdf.js';

const PAYMENT_LABEL = {
  CASH: 'Cash',
  EVC_PLUS: 'EVC Plus',
  ZAAD: 'Zaad',
  E_DAHAB: 'eDahab',
};

export default function ReceiptPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reprint, setReprint] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setSale(await getSale(id));
      } catch (err) {
        setError(err?.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  function onPrint() {
    setReprint(true);
    setTimeout(() => window.print(), 50);
  }

  function onDownloadPdf() {
    if (!sale) return;
    downloadReceiptPdf(sale, { copy: reprint });
  }

  if (loading) return <div className="p-6 text-ink-secondary">{t('common.loading')}</div>;
  if (error)
    return (
      <div className="panel p-6 text-status-danger">
        {error}
        <div className="mt-3">
          <Link to="/pos" className="btn-secondary text-sm">
            ← {t('pos.backToPos')}
          </Link>
        </div>
      </div>
    );
  if (!sale) return null;

  return (
    <div>
      {/* Screen-only action bar */}
      <div className="flex items-center justify-between print:hidden">
        <button
          type="button"
          onClick={() => navigate('/pos')}
          className="text-sm text-ink-secondary hover:text-ink-primary"
        >
          ← {t('pos.backToPos')}
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onDownloadPdf} className="btn-secondary">
            {t('pos.downloadPdf')}
          </button>
          <button type="button" onClick={onPrint} className="btn-secondary">
            {t('pos.print')}
          </button>
          <Link to="/pos" className="btn-primary">
            {t('pos.newSale')}
          </Link>
        </div>
      </div>

      <article className="panel mx-auto mt-4 max-w-md p-6 print:mt-0 print:border-0 print:shadow-none">
        <header className="text-center">
          <h1 className="text-lg font-semibold text-ink-primary">{sale.branchName}</h1>
          {sale.branchAddress && <p className="text-xs text-ink-secondary">{sale.branchAddress}</p>}
          {sale.branchPhone && (
            <p className="text-xs text-ink-secondary">Tel: {sale.branchPhone}</p>
          )}
        </header>

        <div className="mt-3 flex items-center justify-between text-xs text-ink-secondary">
          <span className="font-mono text-ink-primary">{sale.receiptNo}</span>
          <span>{new Date(sale.createdAt).toLocaleString()}</span>
        </div>
        {reprint && (
          <div className="mt-2 text-center text-xs font-bold uppercase tracking-wider text-status-danger">
            {t('pos.copy')}
          </div>
        )}

        <table className="mt-4 w-full border-y border-dashed border-line text-xs">
          <thead>
            <tr className="text-ink-muted">
              <th className="py-1 text-left font-normal uppercase">{t('pos.cols.item')}</th>
              <th className="py-1 text-right font-normal uppercase">{t('pos.cols.qty')}</th>
              <th className="py-1 text-right font-normal uppercase">{t('pos.cols.price')}</th>
              <th className="py-1 text-right font-normal uppercase">{t('pos.cols.total')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dashed divide-line">
            {sale.items.map((item) => (
              <tr key={item.id} className="align-top">
                <td className="py-1 pr-2">
                  <div className="text-ink-primary">
                    {item.medicine.genericName} {item.medicine.strength}
                  </div>
                  <div className="text-[10px] text-ink-muted">
                    {item.medicine.brandName} · {item.medicine.form}
                  </div>
                </td>
                <td className="py-1 text-right tabular-nums">{item.qty}</td>
                <td className="py-1 text-right tabular-nums">
                  ${Number(item.unitPrice).toFixed(2)}
                </td>
                <td className="py-1 text-right tabular-nums">
                  ${Number(item.lineTotal).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 flex items-center justify-between text-sm font-semibold">
          <span>{t('pos.total')}</span>
          <span className="tabular-nums">${Number(sale.total).toFixed(2)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-ink-secondary">
          <span>{t('pos.payment')}</span>
          <span>{PAYMENT_LABEL[sale.paymentMethod] || sale.paymentMethod}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-ink-secondary">
          <span>{t('pos.cashier')}</span>
          <span>{sale.cashierName}</span>
        </div>

        <p className="mt-5 text-center text-xs text-ink-muted">{t('pos.thankYou')}</p>
      </article>
    </div>
  );
}
