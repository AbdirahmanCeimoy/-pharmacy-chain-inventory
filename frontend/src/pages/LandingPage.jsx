import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '../i18n';
import { Logo } from '../components/branding/Logo.jsx';

export default function LandingPage() {
  const { t, i18n } = useTranslation();

  return (
    <div className="min-h-full bg-surface-page">
      {/* NAV */}
      <header className="border-b border-line bg-surface-panel">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/welcome" className="flex items-center gap-2">
            <Logo size={32} withWordmark />
          </Link>
          <nav className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {['en', 'so'].map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLanguage(l)}
                  className={
                    i18n.language === l
                      ? 'rounded-md bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink-primary'
                      : 'rounded-md px-2.5 py-1 text-xs text-ink-secondary hover:bg-surface-muted'
                  }
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <Link to="/login" className="btn-primary text-sm">
              {t('landing.ctaPrimary')}
            </Link>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:py-24">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-primary">
              {t('landing.eyebrow')}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink-primary sm:text-5xl">
              {t('landing.hero.headline')}
            </h1>
            <p className="mt-5 max-w-xl text-base text-ink-secondary sm:text-lg">
              {t('landing.hero.lead')}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/login" className="btn-primary">
                {t('landing.ctaPrimary')} →
              </Link>
              <a
                href="#features"
                className="btn-secondary"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                {t('landing.ctaSecondary')}
              </a>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-secondary">
              <li>✓ {t('landing.bullets.fefo')}</li>
              <li>✓ {t('landing.bullets.race')}</li>
              <li>✓ {t('landing.bullets.bilingual')}</li>
            </ul>
          </div>

          <div className="relative">
            <div className="panel p-6">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <span className="text-xs font-semibold uppercase text-ink-muted">
                  Receipt sample
                </span>
                <span className="font-mono text-xs text-ink-secondary">MOG-01-000064</span>
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="flex justify-between">
                  <span>Paracetamol 500 mg</span>
                  <span className="tabular-nums">$3.50</span>
                </li>
                <li className="flex justify-between">
                  <span>Amoxicillin 500 mg × 2</span>
                  <span className="tabular-nums">$17.00</span>
                </li>
                <li className="flex justify-between">
                  <span>Cetirizine 10 mg</span>
                  <span className="tabular-nums">$2.00</span>
                </li>
              </ul>
              <div className="mt-3 flex justify-between border-t border-line pt-3 text-sm font-semibold">
                <span>Total</span>
                <span className="tabular-nums">$22.50</span>
              </div>
              <p className="mt-3 text-center text-xs text-ink-muted">
                {t('landing.hero.sampleHint')}
              </p>
            </div>
            <div className="absolute -right-3 -top-3 rotate-6 rounded-md bg-brand-primary px-2.5 py-1 text-xs font-semibold text-white shadow">
              FEFO
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="border-y border-line bg-surface-panel">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <h2 className="text-2xl font-semibold text-ink-primary sm:text-3xl">
            {t('landing.problem.title')}
          </h2>
          <p className="mt-3 max-w-3xl text-ink-secondary">{t('landing.problem.body')}</p>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {['problem1', 'problem2', 'problem3'].map((k) => (
              <div key={k} className="rounded-panel border border-line p-5">
                <div className="text-3xl">
                  {k === 'problem1' ? '📦' : k === 'problem2' ? '📉' : '🧮'}
                </div>
                <h3 className="mt-3 font-semibold text-ink-primary">
                  {t(`landing.problems.${k}.title`)}
                </h3>
                <p className="mt-1 text-sm text-ink-secondary">{t(`landing.problems.${k}.body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-2xl font-semibold text-ink-primary sm:text-3xl">
          {t('landing.features.title')}
        </h2>
        <p className="mt-2 max-w-2xl text-ink-secondary">{t('landing.features.lead')}</p>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            ['fefo', '⏱️'],
            ['concurrency', '🔒'],
            ['transfers', '🔄'],
            ['expiry', '📅'],
            ['profit', '📊'],
            ['controlled', '💊'],
          ].map(([k, emoji]) => (
            <div key={k} className="rounded-panel border border-line bg-surface-panel p-5">
              <div className="text-2xl">{emoji}</div>
              <h3 className="mt-3 font-semibold text-ink-primary">
                {t(`landing.features.items.${k}.title`)}
              </h3>
              <p className="mt-1 text-sm text-ink-secondary">
                {t(`landing.features.items.${k}.body`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW */}
      <section className="border-t border-line bg-surface-panel">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <h2 className="text-2xl font-semibold text-ink-primary sm:text-3xl">
            {t('landing.how.title')}
          </h2>
          <ol className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-4">
            {['step1', 'step2', 'step3', 'step4'].map((k, i) => (
              <li key={k} className="rounded-panel border border-line bg-surface-page p-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-sm font-semibold text-white">
                  {i + 1}
                </div>
                <h3 className="mt-3 font-semibold text-ink-primary">
                  {t(`landing.how.${k}.title`)}
                </h3>
                <p className="mt-1 text-sm text-ink-secondary">{t(`landing.how.${k}.body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="panel bg-brand-primary p-10 text-center text-white">
          <h2 className="text-2xl font-semibold sm:text-3xl">{t('landing.cta.title')}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm opacity-90">{t('landing.cta.body')}</p>
          <Link
            to="/login"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-brand-primary shadow hover:bg-surface-muted"
          >
            {t('landing.ctaPrimary')} →
          </Link>
          <p className="mt-4 text-xs text-white/80">
            {t('landing.cta.demoHint')}: <span className="font-mono">owner@pharmacy.so</span> /{' '}
            <span className="font-mono">Owner@123</span>
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-line bg-surface-panel">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-4 py-6 text-xs text-ink-secondary sm:flex-row sm:items-center">
          <span>
            © {new Date().getFullYear()} {t('app.name')}
          </span>
          <span>{t('landing.footer.build')}</span>
        </div>
      </footer>
    </div>
  );
}
