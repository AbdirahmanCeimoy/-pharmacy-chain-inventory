// Three-step password recovery on a single page:
//   step 'request' → enter email, get OTP.
//   step 'verify'  → enter 6-digit code (with resend countdown).
//   step 'reset'   → enter new password + confirm.
//   step 'done'    → success + link back to login.

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '../i18n';
import { Logo } from '../components/branding/Logo.jsx';
import PasswordInput from '../components/ui/PasswordInput.jsx';
import {
  requestPasswordReset,
  verifyPasswordOtp,
  resetPassword as resetPasswordApi,
} from '../api/password_reset.js';

const RESEND_SECONDS = 60;

export default function ForgotPasswordPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function onRequest(e) {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t('forgot.enterValidEmail'));
      return;
    }
    setBusy(true);
    try {
      const res = await requestPasswordReset(email.trim().toLowerCase());
      setNotice(res.message || t('forgot.sentNotice'));
      setStep('verify');
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(e) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(otp.trim())) {
      setError(t('forgot.invalidOtp'));
      return;
    }
    setBusy(true);
    try {
      const res = await verifyPasswordOtp(email.trim().toLowerCase(), otp.trim());
      setResetToken(res.resetToken);
      setStep('reset');
      setNotice(null);
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    setError(null);
    setBusy(true);
    try {
      await requestPasswordReset(email.trim().toLowerCase());
      setNotice(t('forgot.resent'));
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onReset(e) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError(t('forgot.pwTooShort'));
      return;
    }
    if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError(t('forgot.pwNeedsMix'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('forgot.pwMismatch'));
      return;
    }
    setBusy(true);
    try {
      await resetPasswordApi({
        email: email.trim().toLowerCase(),
        resetToken,
        newPassword,
      });
      setStep('done');
      setNotice(t('forgot.success'));
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  }

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
        <div className="panel w-full max-w-sm p-6">
          {step === 'request' && (
            <form onSubmit={onRequest} noValidate>
              <div className="flex flex-col items-center gap-2 text-center">
                <Logo size={44} />
                <h1 className="mt-2 text-xl font-semibold text-ink-primary">{t('forgot.title')}</h1>
                <p className="text-sm text-ink-secondary">{t('forgot.subtitle')}</p>
              </div>
              {error && (
                <div
                  role="alert"
                  className="mt-4 rounded-md border border-status-danger/40 bg-status-danger/10 p-3 text-sm text-status-danger"
                >
                  {error}
                </div>
              )}
              <label className="mt-5 block text-sm font-medium text-ink-primary">
                {t('auth.email')}
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.emailPlaceholder')}
                  className="input mt-1"
                />
              </label>
              <button type="submit" disabled={busy} className="btn-primary mt-5 w-full">
                {busy ? t('common.loading') : t('forgot.sendCode')}
              </button>
              <Link
                to="/login"
                className="mt-4 block text-center text-xs text-ink-secondary hover:text-ink-primary"
              >
                ← {t('forgot.backToLogin')}
              </Link>
            </form>
          )}

          {step === 'verify' && (
            <form onSubmit={onVerify} noValidate>
              <div className="flex flex-col items-center gap-2 text-center">
                <Logo size={44} />
                <h1 className="mt-2 text-xl font-semibold text-ink-primary">
                  {t('forgot.verifyTitle')}
                </h1>
                <p className="text-sm text-ink-secondary">{t('forgot.verifyLead', { email })}</p>
              </div>
              {notice && (
                <div className="mt-4 rounded-md border border-status-info/40 bg-status-info/10 p-3 text-sm text-status-info">
                  {notice}
                </div>
              )}
              {error && (
                <div
                  role="alert"
                  className="mt-4 rounded-md border border-status-danger/40 bg-status-danger/10 p-3 text-sm text-status-danger"
                >
                  {error}
                </div>
              )}
              <label className="mt-5 block text-sm font-medium text-ink-primary">
                {t('forgot.codeLabel')}
                <input
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  autoFocus
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="input mt-1 text-center font-mono text-lg tracking-widest"
                />
              </label>
              <button
                type="submit"
                disabled={busy || otp.length !== 6}
                className="btn-primary mt-5 w-full"
              >
                {busy ? t('common.loading') : t('forgot.verifyCode')}
              </button>
              <div className="mt-3 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setStep('request')}
                  className="text-ink-secondary hover:text-ink-primary"
                >
                  ← {t('forgot.changeEmail')}
                </button>
                <button
                  type="button"
                  onClick={onResend}
                  disabled={cooldown > 0 || busy}
                  className="text-brand-primary disabled:cursor-not-allowed disabled:text-ink-muted"
                >
                  {cooldown > 0 ? t('forgot.resendIn', { seconds: cooldown }) : t('forgot.resend')}
                </button>
              </div>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={onReset} noValidate>
              <div className="flex flex-col items-center gap-2 text-center">
                <Logo size={44} />
                <h1 className="mt-2 text-xl font-semibold text-ink-primary">
                  {t('forgot.resetTitle')}
                </h1>
                <p className="text-sm text-ink-secondary">{t('forgot.resetLead')}</p>
              </div>
              {error && (
                <div
                  role="alert"
                  className="mt-4 rounded-md border border-status-danger/40 bg-status-danger/10 p-3 text-sm text-status-danger"
                >
                  {error}
                </div>
              )}
              <label className="mt-5 block text-sm font-medium text-ink-primary">
                {t('forgot.newPassword')}
                <PasswordInput
                  className="mt-1"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  placeholder={t('forgot.newPasswordPlaceholder')}
                />
              </label>
              <label className="mt-3 block text-sm font-medium text-ink-primary">
                {t('forgot.confirmPassword')}
                <PasswordInput
                  className="mt-1"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  placeholder={t('forgot.confirmPasswordPlaceholder')}
                />
              </label>
              <p className="mt-2 text-xs text-ink-muted">{t('forgot.pwRule')}</p>
              <button type="submit" disabled={busy} className="btn-primary mt-5 w-full">
                {busy ? t('common.loading') : t('forgot.updatePassword')}
              </button>
            </form>
          )}

          {step === 'done' && (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-status-success/15 text-2xl text-status-success">
                ✓
              </div>
              <h1 className="mt-3 text-xl font-semibold text-ink-primary">
                {t('forgot.doneTitle')}
              </h1>
              <p className="mt-2 text-sm text-ink-secondary">{t('forgot.doneBody')}</p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="btn-primary mt-5 w-full"
              >
                {t('forgot.backToLoginNow')}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
