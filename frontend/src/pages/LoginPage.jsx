import { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext.jsx';
import { setLanguage } from '../i18n';
import { Logo } from '../components/branding/Logo.jsx';
import PasswordInput from '../components/ui/PasswordInput.jsx';

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (status === 'authenticated') return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    // Trim leading/trailing whitespace on the password too — copy-paste from
    // email clients and password managers often slips a trailing space in,
    // and bcrypt's compare treats that as a wrong password.
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

  const hasEdgeWhitespace =
    email !== email.trim() || (password && password !== password.replace(/^\s+|\s+$/g, ''));

  return (
    <div className="flex min-h-full flex-col bg-surface-page">
      <header className="border-b border-line bg-surface-panel">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/welcome" className="flex items-center gap-2">
            <Logo size={32} withWordmark />
          </Link>
          <nav className="flex items-center gap-1" aria-label={t('common.language')}>
            {['en', 'so'].map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLanguage(l)}
                className={
                  i18n.language === l
                    ? 'rounded-md bg-surface-muted px-3 py-1 text-xs font-medium text-ink-primary'
                    : 'rounded-md px-3 py-1 text-xs text-ink-secondary hover:bg-surface-muted'
                }
              >
                {l.toUpperCase()}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 grid place-items-center p-4">
        <form onSubmit={onSubmit} className="panel w-full max-w-sm p-6" noValidate>
          <div className="flex flex-col items-center gap-2 text-center">
            <Logo size={48} />
            <h1 className="mt-2 text-xl font-semibold text-ink-primary">{t('auth.signIn')}</h1>
            <p className="text-sm text-ink-secondary">{t('app.tagline')}</p>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-md border border-status-danger/40 bg-status-danger/10 p-3 text-sm text-status-danger"
            >
              {error}
              {hasEdgeWhitespace && (
                <div className="mt-1 text-xs opacity-90">
                  Tip: your input has leading or trailing spaces. We will trim them for you on
                  submit.
                </div>
              )}
            </div>
          )}

          <label className="mt-5 block text-sm font-medium text-ink-primary">
            {t('auth.email')}
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input mt-1"
              placeholder={t('auth.emailPlaceholder')}
            />
          </label>

          <label className="mt-3 block text-sm font-medium text-ink-primary">
            {t('auth.password')}
            <PasswordInput
              className="mt-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              placeholder={t('auth.passwordPlaceholder')}
            />
          </label>

          <div className="mt-2 text-right">
            <Link to="/forgot-password" className="text-xs text-brand-primary hover:underline">
              {t('auth.forgot')}
            </Link>
          </div>

          <button type="submit" disabled={busy} className="btn-primary mt-4 w-full">
            {busy ? t('common.loading') : t('auth.submit')}
          </button>
        </form>
      </main>
    </div>
  );
}
