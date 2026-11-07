import { Link } from 'react-router-dom';

// Top-of-page header block used across every list / detail page: breadcrumbs,
// small blue eyebrow label, big bold title, optional subtitle, optional actions
// slot (export buttons, "+ New" button, etc.). Matches the Miftaxul layout.
export default function PageHeader({ breadcrumbs = [], eyebrow, title, subtitle, actions }) {
  return (
    <header className="mb-4">
      {breadcrumbs.length > 0 && (
        <nav className="text-[11px] text-ink-muted" aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1">
            {breadcrumbs.map((b, i) => (
              <li key={i} className="flex items-center gap-1">
                {b.to ? (
                  <Link to={b.to} className="hover:text-ink-primary">
                    {b.label}
                  </Link>
                ) : (
                  <span className={i === breadcrumbs.length - 1 ? 'text-ink-primary' : ''}>
                    {b.label}
                  </span>
                )}
                {i < breadcrumbs.length - 1 && <span aria-hidden>/</span>}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <div className="text-[10px] font-semibold uppercase tracking-widest text-brand-chart">
              {eyebrow}
            </div>
          )}
          <h1 className="mt-0.5 text-lg font-bold text-ink-primary sm:text-xl">{title}</h1>
          {subtitle && (
            <p className="mt-1 max-w-2xl text-xs text-ink-secondary">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
