import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '../i18n';
import { Logo } from '../components/branding/Logo.jsx';
import { SearchIcon } from '../components/ui/icons.jsx';

/* ================================================================
   Pharmacy image library — kept as visual atmosphere only. Each
   hero/promo image evokes the domain; the written content below is
   the real Project 09 feature set (FEFO, race-safe POS, batches,
   transfers, controlled drugs, reports, etc.).
   ================================================================ */
const IMG = {
  pills:       'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=640&q=80&auto=format&fit=crop',
  blister:     'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=640&q=80&auto=format&fit=crop',
  stethoscope: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=640&q=80&auto=format&fit=crop',
  vitamins:    'https://images.unsplash.com/photo-1550572017-edd951b55104?w=640&q=80&auto=format&fit=crop',
  bottle:      'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=640&q=80&auto=format&fit=crop',
  capsules:    'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=640&q=80&auto=format&fit=crop',
  syrup:       'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=640&q=80&auto=format&fit=crop',
  drops:       'https://images.unsplash.com/photo-1526256262350-7da7584cf5eb?w=640&q=80&auto=format&fit=crop',
  box:         'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=640&q=80&auto=format&fit=crop',
  supplements: 'https://images.unsplash.com/photo-1586015555751-63bb77f4322a?w=640&q=80&auto=format&fit=crop',
  thermometer: 'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=640&q=80&auto=format&fit=crop',
  tablets:     'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=640&q=80&auto=format&fit=crop',
};

/* ---------- tiny inline icons ---------- */
function MailI() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" />
    </svg>
  );
}
function PhoneI() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.4 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.3a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}
function ArrowRightI({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function HeartI() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7-4.5-9.3-9A5.2 5.2 0 0 1 12 6a5.2 5.2 0 0 1 9.3 6c-2.3 4.5-9.3 9-9.3 9z" />
    </svg>
  );
}
function ChevronLeft({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function ChevronRight({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
function DotsV() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg>
  );
}

/* ---------- service icons (for the 4-column strip) ---------- */
function FefoMark() {
  // clock with an outbound arrow — FEFO
  return (
    <svg width="26" height="26" viewBox="0 0 48 48" fill="none" stroke="#EF4444" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="24" cy="24" r="12" />
      <path d="M24 16v8l5 3" />
      <path d="M38 24h7M42 20l4 4-4 4" />
    </svg>
  );
}
function RaceMark() {
  // overlapping checkmark + shield (race-safe)
  return (
    <svg width="28" height="28" viewBox="0 0 48 48" fill="none" stroke="#1F8A4C" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M24 6l14 5v9c0 8-6 14-14 16-8-2-14-8-14-16v-9l14-5z" />
      <path d="M17 24l5 5 10-10" />
    </svg>
  );
}
function MultiBranchMark() {
  // 3 buildings
  return (
    <svg width="28" height="28" viewBox="0 0 48 48" fill="none" stroke="#3952A4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6"  y="18" width="10" height="22" />
      <rect x="18" y="10" width="12" height="30" />
      <rect x="32" y="22" width="10" height="18" />
      <path d="M22 18h4M22 24h4M22 30h4" />
    </svg>
  );
}
function AuditMark() {
  // log lines with checkmark
  return (
    <svg width="28" height="28" viewBox="0 0 48 48" fill="none" stroke="#F2B900" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="6" width="32" height="36" rx="3" />
      <path d="M14 16h20M14 24h14M14 32h10" />
      <path d="M30 30l3 3 6-7" />
    </svg>
  );
}

/* ================================================================ */
export default function LandingPage() {
  const { t, i18n } = useTranslation();

  /* 7 app modules — replaces "Popular Categories" commercial list */
  const modules = [
    { name: 'Dashboard',       img: IMG.stethoscope },
    { name: 'Point of Sale',   img: IMG.pills },
    { name: 'Medicines',       img: IMG.blister },
    { name: 'Batches',         img: IMG.capsules },
    { name: 'Purchase Orders', img: IMG.box },
    { name: 'Transfers',       img: IMG.thermometer },
    { name: 'Reports',         img: IMG.vitamins },
  ];

  /* 4 showcase cards (replace "+10,000 products"). Static — no cart, no price. */
  const showcase = [
    {
      cats: ['Core technical challenge', '25 pts'],
      name: 'FEFO stock allocation',
      body: 'Every sale pulls from the batch expiring soonest. A second batch kicks in only when the first runs out.',
      img: IMG.blister,
      rating: 5,
      badge: '13 / 13 features done',
    },
    {
      cats: ['Concurrency', 'Core challenge proof'],
      name: 'Race-safe POS',
      body: 'Two cashiers, same last unit. SELECT ... FOR UPDATE picks one winner; the other reads OUT_OF_STOCK.',
      img: IMG.capsules,
      rating: 5,
      badge: '0 oversells',
    },
    {
      cats: ['Compliance', 'Pharmacist-only'],
      name: 'Controlled drugs register',
      body: 'Append-only. UPDATE and DELETE blocked at the database by SIGNAL SQLSTATE triggers. Running balance per drug.',
      img: IMG.vitamins,
      rating: 5,
      badge: 'DB-trigger enforced',
    },
    {
      cats: ['Operations', 'HQ · Manager'],
      name: 'Expiry dashboard · 30 / 60 / 90',
      body: 'Colour-coded buckets with value-at-cost per branch. Near-expiry stock can be transferred before it loses.',
      img: IMG.tablets,
      rating: 5,
      badge: 'One SQL query / load',
    },
  ];

  const promos = [
    { tag: 'BATCH ENGINE',      title: 'FEFO at\nthe counter',       bg: 'bg-[#D9E6F3]', tagColor: 'text-brand-primary',   img: IMG.box },
    { tag: 'EXPIRY RADAR',      title: '30 · 60 · 90\nday buckets',  bg: 'bg-[#FADDE2]', tagColor: 'text-[#C04B6A]',       img: IMG.bottle },
    { tag: 'PROFIT OPS',        title: 'Honest cost\nper batch',     bg: 'bg-[#DCEEDA]', tagColor: 'text-[#4A8C3B]',       img: IMG.syrup },
    { tag: 'COMPLIANCE',        title: 'Controlled\ndrugs register', bg: 'bg-[#FAF0CF]', tagColor: 'text-[#9E7A1B]',       img: IMG.vitamins },
  ];

  return (
    <div className="min-h-full bg-white">
      {/* =========== TOP STRIP =========== */}
      <div className="bg-brand-nav text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-[11px] sm:px-6">
          <div className="flex items-center gap-5 text-white/80">
            <span className="inline-flex items-center gap-1.5"><MailI /> info@medicap.so</span>
            <span className="hidden items-center gap-1.5 sm:inline-flex"><PhoneI /> +252 61 234 5678</span>
          </div>
          <div className="flex items-center gap-2">
            {['F', 'X', 'IG', 'IN'].map((s) => (
              <span key={s} className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 text-[9px] font-semibold text-white/80">{s}</span>
            ))}
          </div>
        </div>
      </div>

      {/* =========== NAV =========== */}
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6">
          <Link to="/welcome" className="flex items-center">
            <Logo size={34} tone="light" />
          </Link>
          <nav className="hidden items-center gap-6 text-[13px] font-semibold uppercase tracking-wide text-ink-primary lg:flex">
            <a href="#home" className="text-brand-chart">Home</a>
            <a href="#features" className="hover:text-brand-chart">Features</a>
            <a href="#modules" className="hover:text-brand-chart">Modules</a>
            <a href="#roles" className="hover:text-brand-chart">Roles</a>
            <a href="#stack" className="hover:text-brand-chart">Stack</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-1 sm:flex">
              {['en', 'so'].map((l) => (
                <button key={l} type="button" onClick={() => setLanguage(l)}
                  className={i18n.language === l
                    ? 'rounded-md bg-brand-primary/10 px-2.5 py-1 text-xs font-semibold text-brand-primary'
                    : 'rounded-md px-2.5 py-1 text-xs text-ink-secondary hover:bg-surface-muted'}
                >{l.toUpperCase()}</button>
              ))}
            </div>
            <button type="button" className="rounded-full p-2 text-ink-secondary hover:bg-surface-muted" aria-label="Favourites"><HeartI /></button>
            <button type="button" className="rounded-full p-2 text-ink-secondary hover:bg-surface-muted" aria-label="Menu"><DotsV /></button>
            <Link to="/login" className="inline-flex items-center gap-2 rounded-full bg-brand-chart px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95">
              Open the app
            </Link>
          </div>
        </div>
      </header>

      {/* =========== HERO =========== */}
      <section
        id="home"
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #CCE7F2 0%, #DDF0F8 45%, #E8F2FA 100%)' }}
      >
        <button type="button" aria-label="Previous" className="absolute left-4 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-white/50 text-ink-primary shadow backdrop-blur md:flex">
          <ChevronLeft />
        </button>
        <button type="button" aria-label="Next" className="absolute right-4 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-white/50 text-ink-primary shadow backdrop-blur md:flex">
          <ChevronRight />
        </button>

        <img src={IMG.capsules}    alt="" aria-hidden className="absolute left-0 top-10 hidden h-40 w-44 -translate-x-8 rotate-[-10deg] rounded-2xl object-cover shadow-xl md:block" />
        <img src={IMG.blister}     alt="" aria-hidden className="absolute left-12 bottom-14 hidden h-36 w-40 rotate-[8deg] rounded-2xl object-cover shadow-xl lg:block" />
        <img src={IMG.pills}       alt="" aria-hidden className="absolute right-0 top-8 hidden h-40 w-56 translate-x-10 rotate-[8deg] rounded-2xl object-cover shadow-xl md:block" />
        <img src={IMG.stethoscope} alt="" aria-hidden className="absolute right-12 bottom-12 hidden h-36 w-40 rotate-[-6deg] rounded-2xl object-cover shadow-xl lg:block" />

        <div className="relative mx-auto max-w-3xl px-4 py-24 text-center sm:py-28">
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-ink-primary sm:text-5xl lg:text-[56px]">
            Pharmacy chain inventory,<br />done right.
          </h1>

          {/* Search bar — static display */}
          <div aria-hidden className="mx-auto mt-10 flex max-w-xl items-center gap-2 rounded-full border border-line bg-white p-1.5 shadow-lg select-none">
            <span className="flex items-center gap-2 rounded-full bg-surface-sunken px-4 py-2.5 text-sm font-medium text-ink-primary">
              All features
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            </span>
            <span className="flex flex-1 items-center gap-2 px-3 text-sm text-ink-muted">
              FEFO · race-safe POS · controlled drugs · transfers …
            </span>
            <span className="pr-2 text-ink-muted"><SearchIcon width={16} height={16} /></span>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/login" className="rounded-full bg-brand-nav px-7 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-brand-primary">Open the app</Link>
            <a href="#features" className="rounded-full border border-line bg-white px-7 py-3 text-sm font-semibold text-ink-primary shadow transition hover:border-brand-primary hover:text-brand-primary">See features</a>
          </div>

          <div className="mt-12 flex justify-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-ink-muted/40" />
            <span className="h-1.5 w-6 rounded-full bg-brand-primary" />
            <span className="h-1.5 w-1.5 rounded-full bg-ink-muted/40" />
          </div>
        </div>
      </section>

      {/* =========== CORE CHALLENGE STRIP (4 items) =========== */}
      <section id="features" className="bg-white py-14">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 sm:px-6 md:grid-cols-4">
          {[
            { Mark: FefoMark,         title: 'FEFO',             body: 'Earliest-expiring batch first, every sale.', ring: 'ring-status-danger/20 bg-status-danger/5' },
            { Mark: RaceMark,         title: 'Race-safe',        body: 'Two cashiers, one wins. Never a negative.',  ring: 'ring-status-success/20 bg-status-success/5' },
            { Mark: MultiBranchMark,  title: 'Multi-branch',     body: 'HQ sees the chain; manager sees the branch.', ring: 'ring-brand-primary/20 bg-brand-primary/5' },
            { Mark: AuditMark,        title: 'Audit trail',      body: 'Who, when, why — on every stock movement.',   ring: 'ring-status-warning/20 bg-status-warning/5' },
          ].map((s) => (
            <div key={s.title} className="flex items-start gap-4">
              <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ring-1 ${s.ring}`}>
                <s.Mark />
              </div>
              <div className="min-w-0 pt-1">
                <h3 className="text-[15px] font-semibold text-ink-primary">{s.title}</h3>
                <p className="mt-1 text-[12px] leading-snug text-ink-secondary">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =========== PROMO CARDS — real feature pillars =========== */}
      <section className="bg-white pb-16">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {promos.map((p) => (
            <div
              key={p.title}
              aria-hidden
              className={`relative overflow-hidden rounded-xl ${p.bg} p-6 min-h-[200px] select-none`}
            >
              <div className={`text-[9px] font-semibold uppercase tracking-[0.14em] ${p.tagColor}`}>
                {p.tag}
              </div>
              <h3 className="mt-2 whitespace-pre-line text-[22px] font-semibold leading-[1.15] text-ink-primary">
                {p.title}
              </h3>
              <span className="absolute bottom-6 left-6 flex h-9 items-center gap-2 rounded-full bg-brand-nav pl-1 pr-4 text-xs font-semibold text-white">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15">
                  <ArrowRightI size={12} />
                </span>
                Learn more
              </span>
              <img
                src={p.img}
                alt=""
                aria-hidden
                className="pointer-events-none absolute right-0 top-1/2 h-[120%] w-[55%] -translate-y-1/2 object-cover opacity-95"
                style={{ maskImage: 'linear-gradient(to left, black 65%, transparent)', WebkitMaskImage: 'linear-gradient(to left, black 65%, transparent)' }}
              />
            </div>
          ))}
        </div>
      </section>

      {/* =========== ROLES (3 cards) =========== */}
      <section id="roles" className="bg-[#F7F8FB] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-chart">Roles &amp; access</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink-primary sm:text-4xl">Three roles. One system.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-ink-secondary">
              Server-enforced permissions on every request. Audit log on every sensitive action.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
            {[
              { role: 'Owner / HQ',        who: 'Chain-wide',      caps: ['Sees all branches', 'Approves POs > $1,000', 'Approves transfers > $500', 'Expiry-loss report', 'Profit per branch'], ring: 'bg-brand-primary' },
              { role: 'Branch Manager',    who: 'Own branch only', caps: ['Raises POs', 'Receives goods', 'Dispatches transfers', 'Starts stock count', 'Approves returns'], ring: 'bg-brand-chart' },
              { role: 'Pharmacist',        who: 'POS counter',     caps: ['Sells OTC + Rx', 'Reads controlled register', 'Prints receipts', 'Blocked during stock count', 'Cannot edit stock'], ring: 'bg-status-success' },
            ].map((r) => (
              <div key={r.role} className="rounded-2xl border border-line bg-surface-panel p-6 shadow-sm">
                <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white ${r.ring}`}>
                  {r.who}
                </div>
                <h3 className="mt-3 text-xl font-semibold text-ink-primary">{r.role}</h3>
                <ul className="mt-4 space-y-2 text-sm text-ink-secondary">
                  {r.caps.map((c) => (
                    <li key={c} className="flex items-start gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="mt-[3px] shrink-0 text-status-success">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========== MODULES (round grid, static) =========== */}
      <section id="modules" className="bg-[#F7F8FB] py-20">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6">
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-chart">Modules</div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink-primary sm:text-4xl">Seven corners of the system.</h2>

          <div className="relative mt-14">
            <button type="button" aria-label="Previous" className="absolute left-0 top-1/2 hidden h-10 w-10 -translate-x-2 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white shadow md:flex">
              <ChevronLeft />
            </button>
            <button type="button" aria-label="Next" className="absolute right-0 top-1/2 hidden h-10 w-10 -translate-y-1/2 translate-x-2 items-center justify-center rounded-full border border-line bg-white shadow md:flex">
              <ChevronRight />
            </button>

            <div className="grid grid-cols-3 gap-6 sm:grid-cols-4 md:grid-cols-7 md:gap-4">
              {modules.map((c) => (
                <div key={c.name} aria-hidden className="group flex flex-col items-center select-none">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-line">
                    <img src={c.img} alt="" className="h-20 w-20 rounded-full object-cover" />
                  </div>
                  <span className="mt-3 text-xs font-medium text-ink-primary">{c.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =========== SHOWCASE CARDS (replaces "+10,000 products") =========== */}
      <section id="stack" className="bg-[#E9EEF4] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-chart">Featured capabilities</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink-primary sm:text-4xl">The core challenge, solved four ways.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-ink-secondary">
              Every rule from the Project 09 brief, running against a real MariaDB with 21 tables and 85 passing integration tests.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {showcase.map((p) => (
              <article
                key={p.name}
                aria-hidden
                className="group relative overflow-hidden rounded-xl bg-white p-4 shadow-sm select-none"
              >
                <div className="absolute left-3 top-3 z-10 rounded-md bg-brand-primary px-2 py-0.5 text-[10px] font-semibold text-white">
                  {p.badge}
                </div>
                <div className="aspect-square overflow-hidden rounded-lg bg-surface-sunken">
                  <img src={p.img} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="mt-4 text-[10px] font-semibold text-[#E5415B]">
                  {p.cats.join(' · ')}
                </div>
                <h3 className="mt-1 text-[15px] font-semibold text-ink-primary">
                  {p.name}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
                  {p.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* =========== TECH STACK STATIC BAND =========== */}
      <section className="bg-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-chart">Tech stack</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink-primary sm:text-4xl">Pinned versions. No magic.</h2>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ['React', '19.3.1'],
              ['Vite', '8.3.5'],
              ['Tailwind', '3.4.19'],
              ['Node', '20+'],
              ['Express', '5'],
              ['MariaDB', '10.4+'],
              ['mysql2', 'latest'],
              ['Zod', '4'],
              ['bcryptjs', '3'],
              ['jsonwebtoken', '9'],
              ['Vitest', '5.1'],
              ['Supertest', '7'],
            ].map(([name, ver]) => (
              <div key={name} className="flex items-center justify-between rounded-lg border border-line bg-surface-sunken px-4 py-2.5">
                <span className="text-sm font-semibold text-ink-primary">{name}</span>
                <span className="font-mono text-xs text-ink-muted">v{ver}</span>
              </div>
            ))}
          </div>
          {/* baseline stats */}
          <dl className="mt-12 grid grid-cols-2 gap-6 md:grid-cols-4">
            {[
              { k: '85',    v: 'Integration tests passing' },
              { k: '21',    v: 'Database tables' },
              { k: '13/13', v: 'Required features shipped' },
              { k: 'EN · SO', v: 'Bilingual UI, phone-ready' },
            ].map((s) => (
              <div key={s.v} className="rounded-xl border border-line bg-surface-panel px-5 py-4 text-center">
                <dt className="text-2xl font-semibold text-brand-primary">{s.k}</dt>
                <dd className="mt-1 text-xs text-ink-secondary">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* =========== CTA =========== */}
      <section id="pricing" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div
            className="relative overflow-hidden rounded-3xl p-10 text-center text-white shadow-2xl sm:p-16"
            style={{ background: 'linear-gradient(135deg, #1E3A6E 0%, #3952A4 50%, #3B82F6 100%)' }}
          >
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full opacity-30 blur-3xl" style={{ background: 'radial-gradient(circle, #5EEAD4 0%, transparent 60%)' }} aria-hidden />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full opacity-20 blur-3xl" style={{ background: 'radial-gradient(circle, #F2B900 0%, transparent 60%)' }} aria-hidden />

            <div className="relative mx-auto flex justify-center">
              <Logo size={40} iconOnly />
            </div>
            <h2 className="relative mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
              Run your pharmacy like it's 2026.
            </h2>
            <p className="relative mx-auto mt-5 max-w-2xl text-lg text-white/80">
              Every batch tracked. Every expiry caught. Every sale FEFO-safe — across
              every branch of your pharmacy chain.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/login" className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-brand-primary shadow-lg transition hover:bg-white/90">
                Open the app
              </Link>
              <a href="#features" className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur hover:bg-white/10">
                See features
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* =========== FOOTER =========== */}
      <footer className="bg-brand-nav text-white/80">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Logo size={32} tone="dark" />
            <p className="mt-4 text-sm text-white/60">
              Pharmacy management, built for Somalia's growing chains. FEFO-safe,
              bilingual, race-ready.
            </p>
            <div className="mt-5 flex items-center gap-2">
              {['F', 'X', 'IG', 'IN'].map((s) => (
                <a key={s} href="#" className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-xs font-semibold text-white/80 transition hover:border-white hover:text-white">{s}</a>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Product</h4>
            <ul className="mt-4 space-y-2 text-sm">
              <li><a href="#features" className="hover:text-white">Features</a></li>
              <li><a href="#modules" className="hover:text-white">Modules</a></li>
              <li><a href="#roles" className="hover:text-white">Roles</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Company</h4>
            <ul className="mt-4 space-y-2 text-sm">
              <li><a href="#" className="hover:text-white">About</a></li>
              <li><a href="#" className="hover:text-white">Branches</a></li>
              <li><a href="#" className="hover:text-white">Partners</a></li>
              <li><a href="#" className="hover:text-white">Careers</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Contact</h4>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="inline-flex items-center gap-2"><MailI /> info@medicap.so</li>
              <li className="inline-flex items-center gap-2"><PhoneI /> +252 61 234 5678</li>
              <li className="text-white/60">Mogadishu · Hargeisa · Baydhabo</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-4 py-6 text-xs text-white/50 sm:flex-row sm:items-center sm:px-6">
            <span>© {new Date().getFullYear()} {t('app.name')} · {t('app.tagline')}</span>
            <span>Pharmacy OS · v1.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
