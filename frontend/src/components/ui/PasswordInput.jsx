// Password input with a show/hide eye toggle.
// Keeps the current value intact when visibility is toggled.

import { useState } from 'react';
import { EyeIcon, EyeOffIcon } from './icons.jsx';

export default function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete = 'current-password',
  required = false,
  name,
  id,
  className = '',
  ariaLabel,
  ...rest
}) {
  const [show, setShow] = useState(false);
  return (
    <div className={`relative ${className}`}>
      <input
        id={id}
        name={name}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        aria-label={ariaLabel}
        className="input pr-10"
        {...rest}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        title={show ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 flex items-center px-2 text-ink-muted hover:text-ink-primary"
        tabIndex={-1}
      >
        {show ? <EyeOffIcon width={16} height={16} /> : <EyeIcon width={16} height={16} />}
      </button>
    </div>
  );
}
