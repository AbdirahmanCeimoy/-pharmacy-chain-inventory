# PharmaTrack — Design System

> Single source of truth for colors, typography, spacing, icons and components.
> Built against the `unslop` and `ui-ux-pro-max-skill` references. All tokens are
> defined in `frontend/tailwind.config.js` and `frontend/src/index.css`.

## 1. Product character

PharmaTrack is a **clinical, data-heavy** tool for pharmacy operators. The character
is quiet and trustworthy — not playful. Every screen has **one bright element**
(usually the data: a KPI value, a receipt, a chart) and quiet navigation, buttons,
and chrome.

**Direction five-liner:**
- **Product:** Multi-branch pharmacy inventory + POS.
- **Character:** Serious, calm, operator-first.
- **World:** Pharmacy counter, receipt printer, cold-chain batches.
- **Moments:** The sale completing. The expiry warning catching a loss.
- **Signature:** The FEFO allocation table on the hero.

## 2. Color system

### 2.1 Palette (6 brand + neutral scale)
Defined in `tailwind.config.js` under `theme.extend.colors`. No gradients, no
decorative hues beyond what is listed.

| Role            | Token                | Hex       | Where it appears                    |
|-----------------|----------------------|-----------|-------------------------------------|
| Brand primary   | `brand.primary`      | `#3952A4` | Sidebar, primary CTAs, hero accents |
| Brand chart     | `brand.chart`        | `#3B82F6` | Charts, info chips, links           |
| Success         | `status.success`     | `#1F8A4C` | Approved, in-stock, completed       |
| Warning         | `status.warning`     | `#F2B900` | Low stock, near expiry (60–90 days) |
| Danger          | `status.danger`      | `#EF4444` | Expired, errors, destructive        |
| Page surface    | `surface.page`       | `#FFFFFF` | Every page background               |
| Panel surface   | `surface.panel`      | `#FFFFFF` | Cards, modals                       |
| Muted surface   | `surface.muted`      | `#F3F4F6` | Hover states, icon badges           |

### 2.2 Text roles (three)
| Role            | Token            | Hex       | Use                      |
|-----------------|------------------|-----------|--------------------------|
| Primary ink     | `ink.primary`    | `#0F172A` | Headings, KPI values     |
| Secondary ink   | `ink.secondary`  | `#64748B` | Body copy, metadata      |
| Muted ink       | `ink.muted`      | `#94A3B8` | Captions, hints          |

### 2.3 Lines
- `line` (`#E5E7EB`) — every border, divider, table row rule.

### 2.4 Status tints
Each status color is also used at `/10` opacity as a quiet surface wash
(`bg-status-warning/10`) for empty states and badge backgrounds. **Never as a
hue gradient.**

## 3. Typography

- **Family:** Poppins (Google Fonts) with `system-ui` fallback.
- **Weights allowed:** 400 (regular), 500 (medium), 600 (semibold). **No 700+**.
- **No italics.** No negative tracking on small text.
- **Numbers** use `tabular-nums` so columns of money/qty align.

### 3.1 Scale
| Role       | Size   | Weight | Example                        |
|------------|--------|--------|--------------------------------|
| Hero       | 48px   | 600    | Landing hero headline          |
| H1         | 30px   | 600    | Page title                     |
| H2         | 24px   | 600    | Section title                  |
| H3         | 16px   | 600    | Card title                     |
| Body       | 14px   | 400    | Paragraphs, table cells        |
| Small      | 12px   | 400/500| Metadata, captions             |
| Micro      | 11px   | 500    | Breadcrumbs, badge labels      |

### 3.2 Anti-patterns (do not use)
- Uppercase + wide tracking on long strings. Only on genuine codes
  (payment method, PO status enum).
- Bold (700+) anywhere.
- Italics.
- Greeting headlines like "Welcome back!". Prefer plain labels: "Dashboard".

## 4. Spacing (4px grid)

Tailwind's default scale is the 4px grid. Use `space-y-6` between page
sections, `gap-4` inside grids, `p-5` on cards. **Equal sizes for equal things.**

## 5. Components

Defined as Tailwind `@layer components` in `frontend/src/index.css`.

### 5.1 Buttons
`.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-info`, `.btn-success`,
`.btn-warning`, `.btn-danger`. Each is a flat pill (`rounded-md`), weight 600,
no icon padding by default. **No arrow decorations ("→") in labels.**

### 5.2 Inputs
`.input` — flat, `rounded-md`, `border-line`, focus ring at `brand-chart/20`.
`.label` — small caps allowed only as the above-field label, 10px.

### 5.3 Panels
`.panel` — `rounded-xl`, `shadow-panel` (soft), `border-line`. The default card.

### 5.4 Badges
`.badge-neutral`, `.badge-success`, `.badge-warning`, `.badge-danger`,
`.badge-info`. Pill shape, 11px semibold.

### 5.5 Tabs
`.tab-list` + `.tab-item` / `.tab-item-active`. Active tab has
`border-brand-chart text-brand-chart` and a `-mb-px` underline.

## 6. Icons

All icons live in `frontend/src/components/ui/icons.jsx`. One inline SVG set,
**one stroke width (1.75)**, one default size (18×18), colored by `currentColor`
so they inherit text role.

**Rule:** No emoji anywhere in the UI. If you need a glyph, add it to this file.

## 7. Charts (Recharts)

- **One accent per chart** for the primary series (`brand.chart` = `#3B82F6`).
- Comparison series use `status.success` and `status.warning` only.
- Grid lines: `#E5E7EB`, dashed `3 3`.
- Axis labels: 11px, `#94A3B8`.
- Tooltip: 12px, 6px radius, `#E5E7EB` border.

## 8. Motion

- Only transitions on `transform`, `opacity`, `color`.
- No looping animation except the login/loading `animate-pulse` skeletons.
- No bouncy easing. Default ease-in-out, 150–200ms.

## 9. Anti-patterns (unslop)

Things that must not land in this UI:
- Hue gradients (`bg-gradient-to-* from-*` with a saturated color).
- Colored glows / `drop-shadow` with non-neutral colors.
- Tilted decorative stickers.
- Emoji icons.
- "✨ New", "🎉 Done" style badges.
- Uppercase tracked long labels.
- Font weight > 600.
- Exclamation marks in UI copy.
- Unverified metric claims ("Save 40% today").

## 10. Internationalization

- Every user-facing string goes through `t()` from `react-i18next`.
- English (`src/i18n/en.json`) and Somali (`src/i18n/so.json`) must stay in sync.
- The product name ("PharmaTrack") is reachable through `t('app.name')` —
  **never hardcode it in JSX**.

## 11. Compliance checklist (pre-merge)

Before merging any UI change, verify:

- [ ] No emoji in JSX.
- [ ] No hue gradients.
- [ ] No `font-bold` / `font-extrabold` / `font-black`.
- [ ] No hardcoded product name.
- [ ] All labels run through `t()`.
- [ ] Icons from `icons.jsx`, not inline paths.
- [ ] Numbers use `tabular-nums`.
- [ ] Buttons use `.btn-*` classes, not ad-hoc color combinations.
- [ ] Colors come from the palette tokens, not raw hex.

## 12. References

- `unslop` by Damir Sokolovsky — https://github.com/heydamir/unslop
- `ui-ux-pro-max-skill` — https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
