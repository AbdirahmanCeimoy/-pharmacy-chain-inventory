# PharmaTrack — Technical Improvements Summary

> Companion to `SYSTEM_AUDIT_REPORT.md`. This file is the plain-language record of
> what changed, why, and how to defend each decision during judging.

## 1. UI/UX improvements (per `unslop` skill)

### 1.1 Landing page — emoji removed, replaced with line icons
- **Before:** Problem cards used 📦 📉 🧮. Feature cards used ⏱️ 🔒 🔄 📅 📊 💊 as
  the primary visual.
- **After:** Each card renders a stroke SVG from `components/ui/icons.jsx`
  (`BoxIcon`, `TrendDownIcon`, `AbacusIcon`, `ClockIcon`, `ShieldIcon`,
  `RefreshIcon`, `CalendarIcon`, `ChartIcon`, `PillIcon`) inside a quiet muted
  badge. Six new icons were added for this.
- **Why it matters:** Emoji is the single loudest "AI-looking" signal `unslop`
  flags. Replacing it with a consistent line-icon set makes the landing page
  look designed rather than vibecoded.

### 1.2 Landing page — decorative arrows removed
- **Before:** Both primary CTAs ended with `→`.
- **After:** Plain button label. The button shape is already the call-to-action.
- **Why:** Button-label decorations are classic AI-UI padding.

### 1.3 Landing page — tilted "FEFO" badge normalized
- **Before:** The FEFO badge on the hero receipt mock was rotated `6deg` on a
  saturated brand background.
- **After:** Flat, non-rotated chip with a subtle border, labeled
  "FEFO allocation" instead of just "FEFO".
- **Why:** Tilted sticker decorations are a visual tell `unslop` flags.
  The receipt mock itself is already "the one bright element" — it does not
  need additional ornament.

### 1.4 Landing page — bullet checkmarks → small dots
- **Before:** `✓` character prefix on each supporting bullet.
- **After:** 4px success-colored dot. No character prefix.
- **Why:** Checkmark glyphs read as emoji filler when they repeat.

### 1.5 Dashboard — gradient KPI backgrounds flattened
- **Before:** Each KPI tile used `bg-gradient-to-br from-{tone}/10 via-white to-white`
  across five tones.
- **After:** Flat `bg-surface-panel`. The tone is expressed by a single 4px
  accent bar on the left edge and a tinted icon badge. Hover rise animation
  removed.
- **Why:** `unslop` rule — "remove hue gradients". Even subtle 10%-tinted
  gradients classify. Flat surfaces + a status bar is the clinical dashboard
  pattern.

### 1.6 Dashboard — type weight reduced
- **Before:** `text-2xl font-bold` for KPI values.
- **After:** `text-2xl font-semibold`.
- **Why:** `unslop` rule — weights 400–600 only.

### 1.7 Breadcrumb hardcoding fixed
- **Before:** `<li>PharmaTrack</li>` hardcoded in the dashboard breadcrumb.
- **After:** `<li>{t('app.name')}</li>`.
- **Why:** Breaks i18n. The product name belongs in a single source of truth.

### 1.8 Uppercase tracked labels — partial sweep
- **Before:** `text-[10px] font-semibold uppercase tracking-wider` was repeated
  on eyebrows, KPI labels, and section headers.
- **After (this pass):** Landing hero eyebrow, dashboard eyebrow, and KPI labels
  switched to sentence-case 12px medium. Uppercase retained only on legitimate
  status codes (payment method, PO status enum display).
- **Remaining:** A full sweep across secondary pages (returns, transfers, stock
  counts) is listed as follow-up in the audit report.

## 2. Design system documentation

### 2.1 New `docs/DESIGN_SYSTEM.md`
A complete, publishable design-system doc covering:
- Product character and five-line direction.
- Full palette with hex and role mapping.
- Three text roles (primary / secondary / muted ink).
- Type scale with explicit weight cap of 600.
- Spacing (4px grid).
- Component inventory with Tailwind class names.
- Icon rule: one line set, one size, one stroke, no emoji.
- Chart rules (one accent, dashed grid, 11px axis labels).
- Motion rules (transform/opacity/color only, no bounce).
- Anti-pattern list from `unslop`.
- Pre-merge compliance checklist.

**Why it matters:** `ui-ux-pro-max-skill` expects a reproducible design-system
file. This is the file a judge or new contributor reads first to understand
"why does the UI look like this".

## 3. Security improvements

### 3.1 Per-email login rate limiter
- **File:** `backend/src/routes/auth.routes.js`
- **Before:** The global `express-rate-limit` (100 req / minute / IP) protected
  the API, but had no per-account window. An attacker sharing a NAT could
  brute-force a known email within quota.
- **After:** New `loginLimiter` middleware on `POST /api/auth/login` keyed on
  the submitted email (lower-cased). 10 attempts per 15 minutes per account.
  Bypassed under `NODE_ENV=test` so the 85-test suite still runs.
- **Error returned:** `TOO_MANY_LOGIN_ATTEMPTS` with a 15-minute hint.
- **Why:** Account-level protection is the defense attackers actually
  encounter. IP-based limits miss the shared-NAT case.

### 3.2 JWT session window shortened
- **Files:** `backend/src/config/env.js`, `backend/.env.example`
- **Before:** `JWT_EXPIRES_IN` defaulted to `12h`.
- **After:** `JWT_EXPIRES_IN` defaults to `2h`, with inline comment explaining
  the rationale (pharmacy terminals are often shared and may be left unlocked).
  Operators can override in `.env` once they ship a refresh-token endpoint.
- **Why:** 12 hours is a long session for a POS system handling financial
  transactions. 2 hours is industry norm.

## 4. What did not change (and why)

### 4.1 Backend layered architecture
Already textbook: routes → services → repositories → pool. No business logic
in routes, no SQL in services. Nothing to improve here.

### 4.2 FEFO + concurrency logic
`backend/src/services/pos.service.js` is the system's technical crown jewel:
`SELECT ... FOR UPDATE` on a dedicated composite index, deterministic cross-item
lock ordering, deadlock retry, DB-level `CHECK (qty_on_hand >= 0)`, append-only
audit trail. Preserved exactly as it was.

### 4.3 Database schema
21 tables, proper FKs, unique constraints, indexes on hot paths, enum columns
for state machines, append-only triggers for the controlled drug register.
No changes made.

### 4.4 Development CORS policy
Dev accepts any `localhost`/`127.0.0.1` origin. Narrowing this hurts the DX
(Vite will try 5174 if 5173 is busy) and production path is already locked to
a single origin. Accepted trade-off, documented in the audit report.

### 4.5 Secondary pages' typography
A full uppercase-tracked-label sweep across every page would double the diff.
The dashboard and landing page cover the surfaces judges see first. Secondary
page sweep is in the follow-up list.

## 5. How to defend these decisions

### "Why did you remove the emoji?"
> "The unslop skill — a published UI design skill for AI-generated interfaces —
> flags emoji labels as one of the three strongest 'AI-looking' signals. I
> replaced them with a consistent 1.75px-stroke SVG line-icon set defined in
> one file. Now the landing page reads as designed, not vibecoded."

### "Why the gradient removal on the dashboard?"
> "Same source: unslop rule 'remove hue gradients'. The dashboard now uses a
> flat surface with a single 4px accent bar on the left as the tone signifier.
> This is the clinical-dashboard pattern — it keeps data forward and chrome quiet."

### "Why shorten JWT to 2 hours?"
> "Pharmacy terminals are shared. A cashier locks the screen, a different
> cashier takes over. A 12-hour token means a stolen device gives an attacker
> most of a workday. Two hours limits blast radius while still covering a
> normal shift segment. Operators can lengthen once they ship a refresh-token
> flow."

### "Why per-email rate limiting?"
> "Global IP-based limits miss shared-NAT attackers. Someone on a university
> WiFi can brute-force a known admin email within the 100-req-per-minute
> global quota. The per-email limiter is keyed on the account, so the attacker
> is throttled on that account regardless of IP."

### "Where is the design system documented?"
> "`docs/DESIGN_SYSTEM.md` — palette, type scale, components, anti-patterns,
> and a pre-merge checklist. New contributors read it first."

## 6. Tests

- `backend` — **85/85 tests passed** after all changes.
- `frontend` — **1/1 tests passed** after all changes.
- No test modifications required; the per-email rate limiter is bypassed
  under `NODE_ENV=test` (same pattern as the existing password-reset limiter).

## 7. Suggested commit messages (manual push)

Since you manage git personally, here are commit-ready messages for the
changes above. Group them however you like:

```
chore(audit): add SYSTEM_AUDIT_REPORT + DESIGN_SYSTEM docs
```

```
feat(ui): replace landing emoji with line-icon set (unslop compliance)
```

```
refactor(ui): flatten dashboard KPI tiles — no gradients, weights ≤ 600
```

```
refactor(ui): remove decorative arrows and tilted badge from landing hero
```

```
fix(ui): use t('app.name') for dashboard breadcrumb instead of hardcoded string
```

```
feat(ui): add Clock, Shield, Alert, TrendDown, Abacus icons to icon set
```

```
security(auth): add per-email login rate limiter (10/15min, bypassed in tests)
```

```
security(auth): shorten JWT_EXPIRES_IN default from 12h to 2h
```

```
docs: add TECHNICAL_IMPROVEMENTS.md summarizing the audit pass
```
