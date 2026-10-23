# Design · Searchmind Apex (Commerce dashboard)

This is the design system for the Apex dashboard. It replaces the previous "minimal" black and white spec, which now lives in `docs/design/DESIGN-minimal-legacy.md` (still in use on `/`, `/login` and pages that are not migrated yet).

The look in one line: a full-screen, calm sage and mint workspace, a near-black surface for the most important number on each page, and green used to highlight.

**Scope rule for the redesign:** keep Apex's data, metrics, logic and page layout. Only the visual layer changes (tokens, type, surfaces, components, chart colours). Pages are migrated one at a time; see the status table at the end.

---

## 1. Principles

1. **Soft and calm.** Mint-white sidebar and header, a light sage canvas, pale mint cards. No pure white, no pure black.
2. **Green is the accent.** Green marks the active state, the primary button, positive change and chart highlights.
3. **One dark card per page.** The page's main number sits on a near-black `#111A12` surface. Everything else stays light.
4. **Full screen.** No outer padding, no floating frame. Sidebar on the left, header strip on top, content on the canvas.
5. **Numbers carry the design.** Large values with a smaller muted unit, tabular figures everywhere.
6. **Honest data.** Apex shows live data. If a view ever shows sample data it must carry a "Demo data" chip, and placeholder targets must be labelled.

---

## 2. Colour tokens

Defined in `src/styles/commerce-design-tokens.css` as `--cd-*` and mapped onto the existing `--apex-*` / `--color-*` variables inside `.apex-dashboard`, so existing class names keep working.

```css
:root{
  /* Surfaces */
  --cd-frame:#F3F8F1;    /* sidebar + header strip */
  --cd-canvas:#E6ECE4;   /* page background behind cards */
  --cd-card:#F6FAF4;     /* cards */
  --cd-sunk:#EAF0E8;     /* tiles, bar tracks, inset areas, hover */
  --cd-line:#E0E7DE;     /* card borders, dividers */
  --cd-line-2:#D2DBD0;   /* stronger borders, inputs, total rows */

  /* Text */
  --cd-ink:#121A13;      /* headings, body, values */
  --cd-ink-2:#4C564D;    /* secondary text */
  --cd-muted:#859085;    /* captions, axis labels, units */

  /* Dark surface */
  --cd-dark:#111A12;     /* hero card, active nav, avatar, tooltip */
  --cd-dark-2:#1C271D;   /* chips on dark */
  --cd-dark-line:#2A362B;/* borders on dark */

  /* Accent */
  --cd-green:#3A9B3F;    /* primary button, live dot, accents */
  --cd-green-2:#2F8434;  /* hover, icons, darker green */
  --cd-mint:#A9EDA2;     /* highlight on dark, light series */
  --cd-mint-soft:#DFF3DB;/* icon bubbles, chips */

  /* Channels */
  --cd-meta:#2F8434;   --cd-meta-soft:#DCEFD9;
  --cd-google:#93D88C; --cd-google-soft:#EAF6E3;

  /* Semantic */
  --cd-pos:#2F8434;  --cd-pos-soft:#DFF0DB;
  --cd-neg:#C2423B;  --cd-neg-soft:#F8E1DF;
  --cd-warn-bg:#F7EED8; --cd-warn:#8A6416;
}
```

### Where each colour goes

| Element | Colour |
|---|---|
| Page background | `--cd-canvas` |
| Sidebar, header strip | `--cd-frame` |
| Cards | `--cd-card` with `--cd-line` border |
| Hero card, active nav item, avatar, chart tooltip | `--cd-dark` |
| Active nav marker (4px left bar) | `--cd-green`; active icon `--cd-mint` |
| Primary button | `--cd-green` bg, white text, hover `--cd-green-2` |
| Positive delta on light | `--cd-pos` text in a card-coloured chip |
| Positive delta on dark | `--cd-mint` text in a `--cd-dark-2` chip |
| Negative delta | `--cd-neg` (on dark: `#F2A49E`) |
| KPI icon bubble | `--cd-mint-soft` bg, `--cd-green-2` icon |
| Selected KPI / selected row | `--cd-mint-soft` fill, `--cd-green` marker |
| Live status dot | `--cd-green` with a 3px `--cd-mint-soft` ring |

### Chart palette

Charts stay on ApexCharts (the existing stack). Colours come from `COMMERCE_CHART_PALETTE` in `src/lib/charts/chartSeriesColors.js`.

| Series | Colour |
|---|---|
| Revenue / first series | `--cd-ink` |
| Meta Ads | `#2F8434` |
| Google Ads | `#93D88C` |
| Comparison / prior period | same hue at 45% opacity, dashed `4 3` |
| Projection | `--cd-green`, dotted `2 4` |
| Single positive metric bars | `--cd-green` |
| Second stacked series | `--cd-mint` |
| Waterfall | subtotals ink, costs `#E9B1AC`, gains `--cd-pos` |

Categorical sequence: `#111A12, #2F8434, #5DBB58, #A9EDA2, #7D877D, #C5CFC4, #3F4C40, #DDF2D8`

Funnel steps: `#111A12, #2F8434, #5DBB58, #93D88C, #A9EDA2`

Heat cells: `rgba(93,187,88, t * 0.35)` where `t` runs 0 to 1 across the period.

Tooltip: `--cd-dark` background, 10px radius, 12px text, rows of colour dot + label + bold value.

---

## 3. Typography

- **Font:** Plus Jakarta Sans (Google Fonts, 400/500/600/700). Fallback `'Helvetica Neue',Helvetica,Arial,sans-serif`.
- Tabular figures on everything numeric: `font-feature-settings:"tnum" 1`.
- Danish number format (`4.019.640`, `2,23%`, `4,87`), DKK shown as `kr.`

| Role | Size / weight |
|---|---|
| Page title | 22px / 600, tracking -0.015em |
| Card title | 15.5px / 600 |
| Body, table cells | 13.5 to 14px / 400 to 500 |
| Captions, axis, subtext | 11 to 12.5px, `--cd-muted` |
| Sidebar section labels | 11.5px / 600, uppercase, tracking 0.04em |
| KPI value | 24px / 700, tracking -0.02em |
| Hero value | 44px / 700 (34px on mobile) |
| Unit after a value | 0.58em / 500, `--cd-muted` (on dark `#9AA79B`) |

---

## 4. Shape and spacing

- Radius: cards **20px**, medium elements **14px**, tiles, buttons, selects **10px**, tags and chips **999px**.
- Card border `1px solid var(--cd-line)`. **No shadows, no gradients.**
- Card padding `22px 24px` (18px on mobile). Grid gap **18px**.
- Content padding `24px 30px 40px` (mobile `18px 16px 32px`).

---

## 5. Layout

```
+------------+---------------------------------------------------+
| SIDEBAR    | HEADER STRIP (frame): search, actions, user       |
| frame      +---------------------------------------------------+
| sticky     | Page title + filters                              |
|            | [ DARK HERO ][ card ][ card ][ card ]             |
| sections   | [ chart card                                   ]  |
|  items     | [ KPI grid                                     ]  |
+------------+---------------------------------------------------+
```

- Sidebar and header strip use `--cd-frame`; content uses `--cd-canvas`.
- Row patterns from the reference: `row-hero` = `1.9fr repeat(3,1fr)`, `cols-2-1` = `2fr 1fr`, `cols-2` = `1fr 1fr`. In Apex we keep each page's existing grid and only restyle it.
- Responsive: test at 390, 768, 1024 and 1400px. Tables scroll inside their card; the page never scrolls sideways.

---

## 6. Components

**Sidebar.** Brand row with a 32px `--cd-card` logo tile. Section labels 11.5px/600 uppercase with a `--cd-line` top divider. Nav item: icon + label, `padding:10px 14px`, radius 10px, `--cd-ink-2`, hover `--cd-sunk`. Active: `--cd-dark` background, white text, mint icon, 4px green bar on the left edge.

**Header strip.** `--cd-frame` background, `--cd-line` bottom border, no shadow. Buttons are 10px radius on `--cd-card`.

**KPI card.** Icon bubble (24px circle, `--cd-mint-soft` bg, `--cd-green-2` icon) + label, value 24px/700 with muted unit, delta chip (`--cd-card`, `--cd-line` border, 8px radius, arrow + signed %). Delta colour follows good or bad.

**Hero KPI card (dark).** Same structure on `--cd-dark`, value 44px, unit `#9AA79B`, delta chip on `--cd-dark-2` with mint (up) or `#F2A49E` (down), caption `#C9D2C9`.

**Segmented control.** `--cd-sunk` track, 10px radius; active segment `--cd-card` with `--cd-line` border.

**Chips / tags.** Pill, 12px/600. Good `--cd-pos-soft` + `--cd-pos`, watch `--cd-warn-bg` + `--cd-warn`, bad `--cd-neg-soft` + `--cd-neg`, Meta `--cd-meta-soft` + `--cd-meta`, Google `--cd-google-soft` + `#4D8A47`.

**Tables.** Header 12.5px `--cd-muted`, numbers right-aligned, `--cd-line` row dividers, total row 700 with `--cd-line-2` top border.

**Pacing bars.** 10px `--cd-sunk` track, 2px ink marker at month elapsed.

---

## 7. Page templates (reference)

| Page | Hero KPI | Other KPIs | Body |
|---|---|---|---|
| Dashboard overview | Total revenue | Orders, Ad spend, MER | Spend donut, insight card, key ratio tiles, revenue vs spend, channel rows, tables |
| Daily overview | Revenue yesterday | Orders, Ad spend, CPA | Stacked daily spend, revenue vs same day last week, day-by-day table with MER heat cell |
| Pace report | Revenue pace % | Projected month, Needed per day, Month elapsed | Cumulative actual vs target vs projection, pacing bars, targets table |
| P&L | Contribution margin | Net revenue, Gross profit, Marketing cost | Waterfall, margin vs marketing, monthly P&L table |
| Ecommerce view | Conversion rate | Sessions, AOV, New customer CAC | Funnel, new vs returning, top products, revenue by category |

Apex keeps its own page content; the templates guide where the dark hero goes and which component styles to use.

---

## 8. Copy

Plain English, sentence case, short captions. No em or en dashes, no emojis, no decorative labels. Caveats go in a quiet note under the card.

---

## 9. Do and don't

**Do:** one dark card per page, green as the accent, units smaller and muted, tabular numbers.

**Don't:** pure `#fff` surfaces or `#000` text, shadows, gradients, outer frames, emojis, invented numbers.

---

## 10. Implementation in Apex

| File | Role |
|---|---|
| `src/styles/commerce-design-tokens.css` | `--cd-*` tokens (no remote `@import` here: it breaks when the file is inlined via nested page imports) |
| `src/app/globals.css` | Loads Plus Jakarta Sans from Google Fonts at the top of the root stylesheet |
| `src/app/(protected)/dashboard/dashboard-shell.css` | Shell: remaps `--apex-*` to `--cd-*` inside `.apex-dashboard`, sidebar, header strip |
| `src/app/(protected)/dashboard/[customerId]/performance-dashboard/performance-dashboard.css` | Shared `apex-perf-*` components (sections, KPI cards, graph card, buttons, chips, date picker) used by most dashboard views |
| `src/lib/charts/chartSeriesColors.js` | `COMMERCE_CHART_PALETTE` and helpers for ApexCharts |

Because the old pages reference `--apex-*` variables, remapping them inside `.apex-dashboard` gives unmigrated pages the new palette automatically. Migrating a page means checking its specific components against this spec and fixing what the remap does not cover.

### Migration status

| Page (`src/app`) | Status |
|---|---|
| Dashboard shell (sidebar + topbar) | Migrated |
| `dashboard/[customerId]/performance-dashboard` (Overview) | Migrated |
| `dashboard/[customerId]/daily-overview` | Pending |
| `dashboard/[customerId]/tools/pace-report` | Pending |
| `dashboard/[customerId]/tools/pnl` | Pending |
| `dashboard/[customerId]/ecommerce` | Pending |
| `dashboard/[customerId]/markets-overview` | Pending |
| Service dashboards, config, other tools | Pending |
| `/`, `/login`, `/home` | Legacy minimal spec |

### Checklist per page

- [ ] Plus Jakarta Sans applied
- [ ] Canvas `#E6ECE4`, frame `#F3F8F1`, cards `#F6FAF4` with `#E0E7DE` border, 20px radius, no shadows
- [ ] Exactly one dark `#111A12` hero card
- [ ] Green for active, primary and positive; mint for highlights on dark
- [ ] Danish number format, units muted and smaller
- [ ] No horizontal page scroll at 390px; tables scroll in their card
- [ ] No em or en dashes in any text
