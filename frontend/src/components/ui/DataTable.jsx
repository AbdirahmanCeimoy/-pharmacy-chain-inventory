// Reusable data table with column sorting, client-side pagination, and
// an empty state. Columns: { key, header, sortable?, align?, className?,
// render?(row), sortValue?(row) }. The default sortValue is row[key].
//
// Sorting is numeric when both sides are numeric strings or numbers;
// otherwise lexicographic case-insensitive. nulls are pushed to the end.

import { useMemo, useState } from 'react';
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon } from './icons.jsx';

function defaultCompare(a, b) {
  const aNull = a == null || a === '';
  const bNull = b == null || b === '';
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  const an = Number(a);
  const bn = Number(b);
  const bothNumeric = !Number.isNaN(an) && !Number.isNaN(bn);
  if (bothNumeric) return an - bn;
  return String(a).toLowerCase().localeCompare(String(b).toLowerCase());
}

export default function DataTable({
  columns,
  data,
  defaultSort = null, // { key, dir: 'asc'|'desc' } or null
  pageSize = 10,
  emptyMessage = 'No results.',
  loading = false,
  loadingMessage = 'Loading...',
  rowKey = 'id',
  rowClassName,
  footerRight,
}) {
  const [sort, setSort] = useState(defaultSort);
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    if (!sort?.key) return data || [];
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return data || [];
    const getter = col.sortValue || ((row) => row[col.key]);
    const copy = [...(data || [])];
    copy.sort((a, b) => {
      const cmp = defaultCompare(getter(a), getter(b));
      return sort.dir === 'desc' ? -cmp : cmp;
    });
    return copy;
  }, [data, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(
    () => sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sorted, currentPage, pageSize]
  );

  function toggleSort(col) {
    if (!col.sortable) return;
    setPage(1);
    setSort((prev) => {
      if (prev?.key !== col.key) return { key: col.key, dir: 'asc' };
      if (prev.dir === 'asc') return { key: col.key, dir: 'desc' };
      return null; // third click clears sort
    });
  }

  const pagesWindow = (() => {
    // show up to 5 numeric buttons centred on the current page
    const span = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + span - 1);
    start = Math.max(1, end - span + 1);
    const list = [];
    for (let p = start; p <= end; p++) list.push(p);
    return list;
  })();

  return (
    <section className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-line text-xs">
          <thead className="bg-surface-muted text-[10px] uppercase tracking-wide text-ink-secondary">
            <tr>
              {columns.map((col) => {
                const isSorted = sort?.key === col.key;
                const alignClass =
                  col.align === 'right'
                    ? 'text-right'
                    : col.align === 'center'
                      ? 'text-center'
                      : 'text-left';
                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={`px-3 py-2 ${alignClass} ${col.className || ''}`}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col)}
                        className={`inline-flex items-center gap-1 font-semibold uppercase tracking-wide ${
                          isSorted
                            ? 'text-ink-primary'
                            : 'text-ink-secondary hover:text-ink-primary'
                        }`}
                      >
                        {col.header}
                        <span className="inline-flex flex-col items-center -space-y-1">
                          <ChevronUpIcon
                            width={10}
                            height={10}
                            className={
                              isSorted && sort.dir === 'asc'
                                ? 'text-brand-primary'
                                : 'text-ink-muted'
                            }
                          />
                          <ChevronDownIcon
                            width={10}
                            height={10}
                            className={
                              isSorted && sort.dir === 'desc'
                                ? 'text-brand-primary'
                                : 'text-ink-muted'
                            }
                          />
                        </span>
                      </button>
                    ) : (
                      <span className="font-semibold">{col.header}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-xs text-ink-muted">
                  {loadingMessage}
                </td>
              </tr>
            )}
            {!loading && paged.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-xs text-ink-muted">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {!loading &&
              paged.map((row, idx) => (
                <tr
                  key={row[rowKey] ?? idx}
                  className={typeof rowClassName === 'function' ? rowClassName(row) : rowClassName}
                >
                  {columns.map((col) => {
                    const alignClass =
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                          ? 'text-center'
                          : 'text-left';
                    return (
                      <td
                        key={col.key}
                        className={`px-3 py-2 align-middle text-xs ${alignClass} ${col.cellClassName || ''}`}
                      >
                        {col.render ? col.render(row) : row[col.key]}
                      </td>
                    );
                  })}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {(sorted.length > pageSize || footerRight) && (
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-muted/40 px-3 py-1.5 text-[11px] text-ink-secondary">
          <div>
            Showing{' '}
            <span className="font-medium text-ink-primary">
              {sorted.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </span>
            –
            <span className="font-medium text-ink-primary">
              {Math.min(currentPage * pageSize, sorted.length)}
            </span>{' '}
            of <span className="font-medium text-ink-primary">{sorted.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="rounded-md border border-line bg-surface-panel p-1 text-ink-secondary hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeftIcon width={14} height={14} />
            </button>
            {pagesWindow.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={
                  p === currentPage
                    ? 'min-w-[28px] rounded-md bg-brand-primary px-2 py-0.5 text-xs font-semibold text-white'
                    : 'min-w-[28px] rounded-md border border-line bg-surface-panel px-2 py-0.5 text-xs text-ink-secondary hover:bg-surface-muted'
                }
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="rounded-md border border-line bg-surface-panel p-1 text-ink-secondary hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRightIcon width={14} height={14} />
            </button>
          </div>
          {footerRight}
        </footer>
      )}
    </section>
  );
}
