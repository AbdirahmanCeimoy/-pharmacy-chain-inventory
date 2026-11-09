import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '../i18n';
import { Logo } from '../components/branding/Logo.jsx';

/* ---------- tiny SVG icons ---------- */
function MailI(p) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>;
}
function PhoneI(p) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.4 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.3a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z"/></svg>;
}
function MapPinI(p) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2"/></svg>;
}
function ArrowR({ s = 14 }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
}
function ChevDown({ s = 18 }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>;
}
function CheckI() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>;
}
function MenuI() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>;
}
function XI() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>;
}

/* Pharmacy images */
const IMG = {
  store: '/pharmacy-store.png',
  hero: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800&q=80&auto=format&fit=crop',
  about: 'https://images.unsplash.com/photo-1576602976047-174e57a47881?w=600&q=80&auto=format&fit=crop',
};

/* Solution data */
const SOLUTIONS = [
  { key: 'multiBranch', icon: '🏪', color: 'from-brand-primary/10 to-brand-chart/10 border-brand-primary/20' },
  { key: 'batchTracking', icon: '📦', color: 'from-status-warning/10 to-status-warning/5 border-status-warning/20' },
  { key: 'fefo', icon: '⏱️', color: 'from-status-danger/10 to-status-danger/5 border-status-danger/20' },
  { key: 'pos', icon: '💳', color: 'from-status-success/10 to-status-success/5 border-status-success/20' },
  { key: 'purchaseOrders', icon: '📋', color: 'from-brand-primary/10 to-brand-primary/5 border-brand-primary/20' },
  { key: 'transfers', icon: '🚚', color: 'from-brand-chart/10 to-brand-chart/5 border-brand-chart/20' },
  { key: 'analytics', icon: '📊', color: 'from-brand-primary/10 to-brand-chart/10 border-brand-chart/20' },
];

/* Why-choose data */
const WHY_DATA = [
  { key: 'visibility', stroke: '#3952A4' },
  { key: 'stock', stroke: '#1F8A4C' },
  { key: 'expiry', stroke: '#EF4444' },
  { key: 'coordination', stroke: '#3B82F6' },
  { key: 'reporting', stroke: '#F2B900' },
  { key: 'security', stroke: '#3952A4' },
];

function WhyIcon({ k, stroke }) {
  const props = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (k) {
    case 'visibility': return <svg {...props}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'stock': return <svg {...props}><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/></svg>;
    case 'expiry': return <svg {...props}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>;
    case 'coordination': return <svg {...props}><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.5 9A9 9 0 0 1 20.5 6.3L23 10M1 14l2.5 3.7A9 9 0 0 0 20.5 15"/></svg>;
    case 'reporting': return <svg {...props}><rect x="3" y="12" width="4" height="9"/><rect x="10" y="3" width="4" height="18"/><rect x="17" y="8" width="4" height="13"/></svg>;
    case 'security': return <svg {...props}><path d="M12 2l8 4v5c0 5.5-3.8 10-8 12-4.2-2-8-6.5-8-12V6l8-4z"/><path d="M9 12l2 2 4-4"/></svg>;
    default: return null;
  }
}

export default function LandingPage() {
  const { t, i18n } = useTranslation();
  const [openFaq, setOpenFaq] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);

  const navLinks = [
    { href: '#about', label: t('landing.about.eyebrow') },
    { href: '#solutions', label: t('landing.solutions.eyebrow') },
    { href: '#how', label: t('landing.howItWorks.eyebrow') },
    { href: '#why', label: t('landing.why.eyebrow') },
    { href: '#faq', label: t('landing.faq.eyebrow') },
    { href: '#contact', label: t('landing.contact.title') },
  ];

  return (
    <div className="min-h-full bg-white">

      {/* =========== NAV =========== */}
      <header className="sticky top-0 z-40 border-b border-line/60 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link to="/welcome" className="shrink-0">
            <Logo size={32} tone="light" />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-7 text-[13px] font-medium text-ink-secondary lg:flex">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="transition hover:text-brand-primary">{l.label}</a>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            {/* Lang */}
            <div className="hidden items-center rounded-lg border border-line p-0.5 sm:flex">
              {['en', 'so'].map((l) => (
                <button key={l} type="button" onClick={() => setLanguage(l)}
                  className={i18n.language === l
                    ? 'rounded-md bg-brand-primary px-2.5 py-1 text-[11px] font-semibold text-white'
                    : 'rounded-md px-2.5 py-1 text-[11px] font-medium text-ink-secondary hover:bg-surface-muted'}
                >{l.toUpperCase()}</button>
              ))}
            </div>
            <Link to="/login" className="hidden rounded-lg bg-brand-primary px-5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-brand-primary-dark sm:inline-flex">
              {t('landing.footer.login')}
            </Link>
            {/* Mobile burger */}
            <button type="button" className="rounded-lg p-1.5 text-ink-secondary hover:bg-surface-muted lg:hidden" onClick={() => setMobileNav(!mobileNav)}>
              {mobileNav ? <XI /> : <MenuI />}
            </button>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {mobileNav && (
          <nav className="border-t border-line bg-white px-4 pb-4 pt-2 lg:hidden">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setMobileNav(false)}
                className="block py-2.5 text-sm font-medium text-ink-primary hover:text-brand-primary">{l.label}</a>
            ))}
            <div className="mt-2 flex items-center gap-2">
              {['en', 'so'].map((l) => (
                <button key={l} type="button" onClick={() => { setLanguage(l); setMobileNav(false); }}
                  className={i18n.language === l
                    ? 'rounded-md bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white'
                    : 'rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-secondary'}
                >{l.toUpperCase()}</button>
              ))}
            </div>
            <Link to="/login" onClick={() => setMobileNav(false)} className="mt-3 block rounded-lg bg-brand-primary py-2.5 text-center text-sm font-semibold text-white">
              {t('landing.footer.login')}
            </Link>
          </nav>
        )}
      </header>

      {/* =========== 01 · HERO =========== */}
      <section className="relative overflow-hidden">
        {/* Blurred pharmacy store background */}
        <img
          src={IMG.store}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full object-cover blur-[0.5px] scale-105"
        />
        {/* Dark navy overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F1E4D]/85 via-[#1E3A6E]/80 to-[#3952A4]/75" />
        {/* Decorative circles */}
        <div className="pointer-events-none absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-brand-chart/15 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-brand-mint/10 blur-3xl" aria-hidden />

        <div className="relative mx-auto flex max-w-7xl flex-col items-center px-4 py-20 sm:px-6 sm:py-28 lg:py-28">
          {/* Text — centered */}
          <div className="max-w-2xl text-center">
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-[56px]">
              {t('landing.hero.title')}
              <br />
              <span className="bg-gradient-to-r from-brand-mint to-[#34D399] bg-clip-text text-transparent">
                {t('landing.hero.highlight')}
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/70">
              {t('landing.hero.subtitle')}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a href="#solutions" className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-brand-primary shadow-lg transition hover:bg-white/90">
                {t('landing.hero.exploreFeatures')}
                <ArrowR />
              </a>
              <a href="#contact" className="inline-flex items-center gap-2 rounded-lg border border-white/25 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10">
                {t('landing.hero.contactUs')}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* =========== 02 · ABOUT =========== */}
      <section id="about" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col items-center gap-10 lg:flex-row lg:gap-16">
            <div className="hidden w-full max-w-sm lg:block">
              <img src={IMG.about} alt="" className="rounded-2xl object-cover shadow-lg" />
            </div>
            <div className="flex-1">
              <span className="inline-block rounded-full bg-brand-primary/10 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-primary">
                {t('landing.about.eyebrow')}
              </span>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink-primary sm:text-4xl">
                {t('landing.about.title')}
              </h2>
              <p className="mt-5 text-base leading-relaxed text-ink-secondary">
                {t('landing.about.body')}
              </p>
              <div className="mt-6 flex items-center gap-6 text-sm text-ink-secondary">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-status-success/10 text-status-success"><CheckI /></span>
                  <span className="font-medium">Multi-branch</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-status-success/10 text-status-success"><CheckI /></span>
                  <span className="font-medium">FEFO</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-status-success/10 text-status-success"><CheckI /></span>
                  <span className="font-medium">Bilingual</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========== 03 · SOLUTIONS =========== */}
      <section id="solutions" className="bg-surface-page py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center">
            <span className="inline-block rounded-full bg-brand-chart/10 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-chart">
              {t('landing.solutions.eyebrow')}
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink-primary sm:text-4xl">
              {t('landing.solutions.title')}
            </h2>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SOLUTIONS.map((s) => (
              <div key={s.key} className={`flex items-center gap-4 rounded-xl border bg-gradient-to-br p-5 transition hover:shadow-md ${s.color}`}>
                <span className="text-2xl" role="img" aria-hidden>{s.icon}</span>
                <span className="text-[15px] font-medium text-ink-primary">{t(`landing.solutions.items.${s.key}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========== 04 · HOW IT WORKS =========== */}
      <section id="how" className="relative overflow-hidden bg-white py-20">
        <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-brand-primary/5 blur-3xl" aria-hidden />
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center">
            <span className="inline-block rounded-full bg-status-success/10 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-status-success">
              {t('landing.howItWorks.eyebrow')}
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink-primary sm:text-4xl">
              {t('landing.howItWorks.title')}
            </h2>
          </div>
          <div className="relative mt-14">
            {/* Vertical line */}
            <div className="absolute left-6 top-0 hidden h-full w-px bg-gradient-to-b from-brand-primary via-brand-chart to-status-success sm:block" aria-hidden />
            <div className="space-y-6">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="flex items-start gap-5 sm:pl-0">
                  <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-primary text-sm font-bold text-white shadow-md shadow-brand-primary/25">
                    {String(n).padStart(2, '0')}
                  </div>
                  <div className="rounded-xl border border-line bg-surface-page px-5 py-4 shadow-sm sm:flex-1">
                    <p className="text-[15px] leading-relaxed text-ink-primary">
                      {t(`landing.howItWorks.step${n}`)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =========== 05 · WHO USES MEDICAP =========== */}
      <section id="users" className="bg-surface-page py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center">
            <span className="inline-block rounded-full bg-brand-primary/10 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-primary">
              {t('landing.users.eyebrow')}
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink-primary sm:text-4xl">
              {t('landing.users.title')}
            </h2>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              { key: 'owner', color: 'border-t-brand-primary', iconBg: 'bg-brand-primary', letter: 'O' },
              { key: 'manager', color: 'border-t-brand-chart', iconBg: 'bg-brand-chart', letter: 'M' },
              { key: 'pharmacist', color: 'border-t-status-success', iconBg: 'bg-status-success', letter: 'P' },
            ].map((role) => (
              <div key={role.key} className={`group rounded-2xl border border-line ${role.color} border-t-4 bg-white p-6 shadow-sm transition hover:shadow-lg`}>
                <div className={`inline-flex h-14 w-14 items-center justify-center rounded-xl ${role.iconBg} text-lg font-bold text-white shadow-sm`}>
                  {role.letter}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-ink-primary">
                  {t(`landing.users.${role.key}`)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                  {t(`landing.users.${role.key}Desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========== 06 · WHY CHOOSE MEDICAP =========== */}
      <section id="why" className="relative overflow-hidden bg-white py-20">
        <div className="pointer-events-none absolute -left-40 bottom-0 h-80 w-80 rounded-full bg-brand-mint/10 blur-3xl" aria-hidden />
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center">
            <span className="inline-block rounded-full bg-status-warning/10 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-status-warning">
              {t('landing.why.eyebrow')}
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink-primary sm:text-4xl">
              {t('landing.why.title')}
            </h2>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {WHY_DATA.map((w) => (
              <div key={w.key} className="group rounded-2xl border border-line bg-surface-page p-6 transition hover:border-brand-primary/30 hover:shadow-md">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-line group-hover:ring-brand-primary/20">
                  <WhyIcon k={w.key} stroke={w.stroke} />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold text-ink-primary">
                  {t(`landing.why.items.${w.key}`)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                  {t(`landing.why.items.${w.key}Desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========== 07 · FAQ =========== */}
      <section id="faq" className="bg-surface-page py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center">
            <span className="inline-block rounded-full bg-brand-chart/10 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-chart">
              {t('landing.faq.eyebrow')}
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink-primary sm:text-4xl">
              {t('landing.faq.title')}
            </h2>
          </div>
          <div className="mt-10 space-y-3">
            {[1, 2, 3, 4, 5].map((n) => {
              const isOpen = openFaq === n;
              return (
                <div key={n} className={`overflow-hidden rounded-xl border bg-white shadow-sm transition ${isOpen ? 'border-brand-primary/30 shadow-md' : 'border-line'}`}>
                  <button type="button" onClick={() => setOpenFaq(isOpen ? null : n)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-4.5 text-left">
                    <span className="text-[15px] font-semibold text-ink-primary">{t(`landing.faq.q${n}`)}</span>
                    <span className={`shrink-0 rounded-full p-1 transition ${isOpen ? 'rotate-180 bg-brand-primary/10 text-brand-primary' : 'text-ink-muted'}`}>
                      <ChevDown />
                    </span>
                  </button>
                  <div className={`grid transition-all duration-200 ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <div className="border-t border-line px-6 pb-5 pt-3">
                        <p className="text-sm leading-relaxed text-ink-secondary">{t(`landing.faq.a${n}`)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========== 08 · CONTACT =========== */}
      <section id="contact" className="relative overflow-hidden py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F1E4D] via-[#1E3A6E] to-[#3952A4]" />
        <div className="pointer-events-none absolute -right-32 top-10 h-64 w-64 rounded-full bg-brand-mint/20 blur-3xl" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {t('landing.contact.title')}
          </h2>
          <p className="mt-3 text-white/70">
            {t('landing.contact.subtitle')}
          </p>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Email */}
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-brand-mint">
                <MailI />
              </div>
              <div className="text-xs font-medium uppercase tracking-wider text-white/50">Email</div>
              <div className="break-all text-sm font-medium text-white">{t('landing.contact.email')}</div>
            </div>
            {/* Phone */}
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-brand-mint">
                <PhoneI />
              </div>
              <div className="text-xs font-medium uppercase tracking-wider text-white/50">
                {i18n.language === 'so' ? 'Telefoon' : 'Phone'}
              </div>
              <div className="text-sm font-medium text-white">{t('landing.contact.phone')}</div>
            </div>
            {/* Location */}
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-brand-mint">
                <MapPinI />
              </div>
              <div className="text-xs font-medium uppercase tracking-wider text-white/50">
                {i18n.language === 'so' ? 'Goobta' : 'Location'}
              </div>
              <div className="text-sm font-medium text-white">{t('landing.contact.location')}</div>
            </div>
          </div>

          <div className="mt-10">
            <Link to="/login" className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-3 text-sm font-semibold text-brand-primary shadow-lg transition hover:bg-white/90">
              {t('landing.footer.login')}
              <ArrowR />
            </Link>
          </div>
        </div>
      </section>

      {/* =========== FOOTER =========== */}
      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between sm:px-6">
          <Logo size={28} tone="light" />
          <nav className="flex flex-wrap items-center gap-5 text-sm text-ink-secondary">
            <a href="#about" className="transition hover:text-brand-primary">{t('landing.footer.about')}</a>
            <a href="#solutions" className="transition hover:text-brand-primary">{t('landing.footer.features')}</a>
            <Link to="/login" className="transition hover:text-brand-primary">{t('landing.footer.login')}</Link>
          </nav>
          <div className="text-xs text-ink-muted">
            &copy; {new Date().getFullYear()} {t('app.name')}. {t('landing.footer.copyright')}
          </div>
        </div>
      </footer>
    </div>
  );
}
