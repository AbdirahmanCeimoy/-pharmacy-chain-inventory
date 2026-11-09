import { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext.jsx';
import { setLanguage } from '../i18n';
import { Logo } from '../components/branding/Logo.jsx';

import { ShieldIcon } from '../components/ui/icons.jsx';

function MailIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function LockIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);

  if (status === 'authenticated') return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.replace(/^\s+|\s+$/g, '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError(t('auth.enterValidEmail'));
      return;
    }
    if (!cleanPassword) {
      setError(t('auth.enterPassword'));
      return;
    }
    setBusy(true);
    try {
      await login(cleanEmail, cleanPassword);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || t('auth.invalid'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-surface-page">
      {/* Decorative colored background washes */}
      <div
        className="absolute -right-32 -top-32 h-96 w-96 rounded-full opacity-50 blur-3xl"
        style={{ background: 'radial-gradient(circle, #DCFCE7 0%, transparent 60%)' }}
        aria-hidden
      />
      <div
        className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full opacity-50 blur-3xl"
        style={{ background: 'radial-gradient(circle, #DBEAFE 0%, transparent 60%)' }}
        aria-hidden
      />

      {/* Header strip for language switcher */}
      <header className="relative">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link to="/welcome" className="flex items-center gap-1.5 text-sm font-medium text-ink-secondary transition hover:text-brand-primary">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 19l-7-7 7-7" /></svg>
              Back to website
            </Link>
          </div>
          <nav className="flex items-center gap-1" aria-label={t('common.language')}>
            {['en', 'so'].map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLanguage(l)}
                className={
                  i18n.language === l
                    ? 'rounded-md bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary'
                    : 'rounded-md px-3 py-1 text-xs text-ink-secondary hover:bg-surface-muted'
                }
              >
                {l.toUpperCase()}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Sign-in card */}
      <main className="relative flex min-h-[calc(100vh-72px)] items-center justify-center px-4 pb-12">
        <div className="relative w-full max-w-md">
          {/* Decorative mint corner shape (top right of card) */}
          <svg
            className="pointer-events-none absolute -right-2 -top-2 h-32 w-32 opacity-40"
            viewBox="0 0 128 128"
            fill="none"
            aria-hidden
          >
            <path
              d="M128 0 C72 0, 0 44, 0 128 L128 128 Z"
              fill="url(#mintGrad)"
            />
            <defs>
              <linearGradient id="mintGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#5EEAD4" />
                <stop offset="1" stopColor="#D1FAE5" />
              </linearGradient>
            </defs>
          </svg>
          {/* Decorative corner (bottom left) */}
          <svg
            className="pointer-events-none absolute -bottom-2 -left-2 h-32 w-32 opacity-40"
            viewBox="0 0 128 128"
            fill="none"
            aria-hidden
          >
            <path d="M0 128 C 56 128, 128 84, 128 0 L0 0 Z" fill="url(#mintGrad2)" />
            <defs>
              <linearGradient id="mintGrad2" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#5EEAD4" />
                <stop offset="1" stopColor="#D1FAE5" />
              </linearGradient>
            </defs>
          </svg>

          <form
            onSubmit={onSubmit}
            className="relative overflow-hidden rounded-2xl border border-line bg-white p-8 shadow-xl"
            noValidate
          >
            {/* Brand lockup */}
            <div className="flex flex-col items-center text-center">
              <Logo size={42} tone="light" />
              <p className="mt-2 text-[12px] font-medium text-ink-secondary">
                {t('auth.tagline')}
              </p>
            </div>

            <div className="mt-8 text-center">
              <h1 className="text-xl font-semibold text-ink-primary">
                {t('auth.signInTitle')}
              </h1>
              <p className="mt-1 text-sm text-ink-secondary">
                {t('auth.signInSubtitle')}
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-5 rounded-lg border border-status-danger/40 bg-status-danger/10 p-3 text-sm text-status-danger"
              >
                {error}
              </div>
            )}

            {/* Email */}
            <label className="mt-6 block">
              <span className="sr-only">{t('auth.email')}</span>
              <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-3 transition focus-within:border-brand-primary focus-within:ring-4 focus-within:ring-brand-primary/10">
                <MailIcon className="shrink-0 text-ink-muted" />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.emailPlaceholder')}
                  className="w-full border-0 bg-transparent text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none"
                />
              </div>
            </label>

            {/* Password */}
            <label className="mt-3 block">
              <span className="sr-only">{t('auth.password')}</span>
              <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-3 transition focus-within:border-brand-primary focus-within:ring-4 focus-within:ring-brand-primary/10">
                <LockIcon className="shrink-0 text-ink-muted" />
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.passwordPlaceholder')}
                  className="w-full border-0 bg-transparent text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none"
                />
              </div>
            </label>

            {/* Remember + forgot */}
            <div className="mt-4 flex items-center justify-between text-xs">
              <label className="inline-flex cursor-pointer items-center gap-2 text-ink-secondary">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-line text-brand-primary focus:ring-brand-primary"
                />
                <span>{t('auth.rememberMe')}</span>
              </label>
              <Link to="/forgot-password" className="font-semibold text-brand-primary hover:underline">
                {t('auth.forgot') || 'Forgot Password?'}
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={busy}
              className="mt-5 w-full rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? t('common.loading') : t('auth.submit')}
            </button>

            {/* Trust strip */}
            <div className="mt-6 flex items-center justify-center gap-2 text-[11px] font-medium text-status-success">
              <ShieldIcon width={14} height={14} />
              {t('auth.trustBadge')}
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
