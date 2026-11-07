// Consistent "Back to list" / "Back" link — chevron-left icon + label.

import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeftIcon } from './icons.jsx';

export default function BackButton({ to, onClick, label = 'Back', className = '' }) {
  const navigate = useNavigate();
  const classes = `inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-ink-secondary hover:bg-surface-muted hover:text-ink-primary ${className}`;
  if (to) {
    return (
      <Link to={to} className={classes}>
        <ChevronLeftIcon width={16} height={16} />
        {label}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} onClick={() => (onClick ? onClick() : navigate(-1))}>
      <ChevronLeftIcon width={16} height={16} />
      {label}
    </button>
  );
}
