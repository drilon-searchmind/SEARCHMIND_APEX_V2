# Design — Searchmind Apex

This replaces the previous **Cobalt** spec (`#213b34` forest green as the primary UI colour, Space Grotesk, `tokens.css`). Apex moves to a **minimal, mostly black-and-white dashboard** — brand colour (dark green / lime) is a *restrained accent*, not a background colour.

**The core rule of this document:** grayscale carries the interface. Colour is spent only where it does a job — a button, a link, an active state, a positive/negative delta, or a heatmap cell that encodes performance. If a color isn't doing one of those jobs, it shouldn't be there.

Layout direction (radius, whitespace, table interaction, KPI hierarchy) comes from a moodboard the team collected — treat those choices as direction to iterate on, not fixed law.

**Status:** **`/` (marketing landing) and `/login` are migrated** to this spec with AcidGrotesk. Cobalt is still live on most feature dashboards. `design-preview.html` is the static reference mockup.

---

## 0. Moodboard alignment

The reference boards (Veritas, Obisoft, AETHER, TWISTY) share a family look that this spec encodes:

| Pattern | What the boards do | Apex rule |
|---|---|---|
| Canvas | Off-white / warm gray page background | `--apex-canvas` `#fafaf9` |
| Cards | White surfaces, **no visible border**, soft drop shadow | Shadow-only elevation, 20px radius |
| Radius | Large, friendly corners (20–30px on cards) | 20px cards, 14px inputs, 100px pills |
| Sidebar | Either near-black rail **or** white sidebar with pill active state | Dashboard shell: near-black + lime bar; standalone pages: light top nav |
| Active nav | Pill highlight (white on gray) or left lime bar — not full green wash | One accent mechanism per context |
| KPI tiles | Bold black number, muted label, optional thin sparkline | Black value, gray label, lime sparkline only |
| Status | Small coloured dot + gray text | No filled status pill backgrounds |
| Tables | Borderless rows, hairline header, hover gray fill | Match `design-preview.html` row hover + selection outline |
| Search | Centered pill with ⌘ hint (AETHER-style) | Pill search on workspace home |
| Charts | Thin strokes, minimal grid, one accent line colour | Lime or ink — not multi-colour decoration |
| Segmented control | Pill toggle (Full stats / Summary) | Use for view switches, not coloured tabs |

**Explicitly not copying from the boards:** pastel card backgrounds, purple/black marketing accents, decorative gradient hero blocks, or status badges with saturated fill backgrounds.

---

## 1. Visual Theme & Atmosphere

Apex is a **working tool**, not a marketing hero. The interface is built from **white, near-black, and gray** — the same restraint as the reference boards: white/near-white canvas, black or near-black ink, light gray hairlines. Colour shows up in exactly four places:

1. **Buttons** — primary action fill
2. **Links / interactive text**
3. **Positive or negative deltas** (small, text-only — a green "+8.2%", a red "-4pt")
4. **Table heatmaps** — a cell's background tints toward the brand green (good) or red (bad) to encode a value at a glance

Everything else — cards, icons, labels, sidebar, borders — stays grayscale.

**Key characteristics:**
- White/near-white canvas and cards; near-black text; light gray hairlines
- Dark sidebar in near-black (not dark green) — a single lime bar marks the active nav item, everything else in the sidebar is grayscale
- Generous whitespace, consistent card alignment — cards line up to a shared grid
- Rounder corners than the app's current default (20px cards vs. today's `rounded-xl` ≈ 12px)
- Depth from soft shadows and tonal shifts, not borders — cards default to no visible outline
- KPI numbers are bold and black, not brand-coloured — colour only touches the delta chip next to them
- One font family throughout — hierarchy from weight and size, not from mixing typefaces or from colour

## 2. Color Palette & Roles

### Grayscale (does the heavy lifting)

| Role | Token | Use |
|---|---|---|
| Canvas | `--apex-canvas` `#fafaf9` | Page background |
| Card | `--apex-card` `#ffffff` | Elevated surface |
| Ink | `--apex-ink` `#131313` | Primary text, KPI values, headings |
| Muted ink | `--apex-ink-muted` `#6b6b6b` | Labels, captions, secondary text |
| Hairline | `--apex-hairline` `#e7e5e2` | Table header underline, dividers — not card borders |
| Sidebar | `--apex-sidebar` `#101010` | Nav shell background (dashboard layout) |
| Sidebar text (idle) | `#ffffff` at ~55% opacity | Idle nav items |
| Sidebar text (active) | `#ffffff` at 100% | Active nav item |

### Brand accent — the only colour, used only in the four slots from §1

| Token | Value | Slot |
|---|---|---|
| `--apex-dark-green` | `#1E2928` | Links, focus rings, occasionally a primary button fill |
| `--apex-lime` | `#C6ED62` | Active nav indicator bar, positive heatmap end, sparkline stroke |
| `--apex-ok` | `#6A8F4D` | Positive delta text, heatmap "good" anchor |
| `--apex-bad` | `#EE6251` | Negative delta text, heatmap "bad" anchor |
| `--apex-warn` | `#C5A75C` | Warning status dot only |

Also exposed in `globals.css` as `--color-dark-green`, `--color-lime`, `--color-light-green`, `--color-black` for legacy Tailwind usage. Add `--color-coral: #EE6251` before reusing the bad accent elsewhere.

### Table heatmap — the one place a color *fill* is allowed on a surface

A metric column (e.g. ROAS, conversion rate) can shade its cell background along a two-stop scale: `white → light-green tint` for above-target values, `white → coral tint` for below-target, both capped around 12–15% opacity so text stays legible. Daily overview heatmaps keep this behaviour when migrating off Cobalt.

### Prohibited
- Coloured icon-chip backgrounds (beige/lime tints behind icons) — icons sit in a plain light-gray or bordered circle, or have no chip at all
- Brand colour as a card, sidebar-section, or full-page background wash
- Lime as body text on white (contrast failure)
- Cobalt `#213b34` as a UI background — retired
- Any hex not listed above — no invented accents

## 3. Typography

**Target font: AcidGrotesk** (searchmind.dk). Files live in `src/font/` and load via `src/styles/acid-grotesk.css`. **Outfit** remains as fallback in `globals.css`.

- **500 (Medium)** — page and section headings (H1, H2), body, labels, table cells
- **700 (Bold)** — KPI values only
- **600 (Semibold)** — card titles and sub-section headings inside a panel

**Do not use `text-transform: uppercase`** for labels, eyebrows, pills, or marketing copy — sentence case only (e.g. "Ét dashboard. Al din data.", not "ÉT DASHBOARD. AL DIN DATA."). Hierarchy comes from size, weight, and colour — not from shouting with caps.

### KPI value
32–36px, weight 700, in `--apex-ink`. The delta next to it is text-only (no background fill): `+8.2%` in `--apex-ok`, `-4pt` in `--apex-bad`.

### Numerals
`font-variant-numeric: tabular-nums` on every KPI value and table number column. Danish number formatting (`toLocaleString("da-DK", …)`) already used elsewhere in the app — keep using it.

## 4. Component Styling

### Cards
- White on `#fafaf9` canvas — radius 20px, no border by default
- Shadow: `--apex-shadow-low`
- **Internal padding:** `--apex-space-card` (32px) on all sides — same on every card type
- Cards align to a shared grid — flush top/bottom edges across a row

### KPI tile
- Icon: plain, in a thin-bordered gray circle or no chip — **no coloured background**
- Bold black value + muted gray label
- Optional sparkline: thin single-stroke line in `--apex-lime`
- Delta: text-only, colored, no pill background

### Tables
- Header row: muted gray, 13–14px/500, hairline underneath
- Default row: no border, no tint
- Hover: light gray background (`#f4f3f1`)
- Shift-click range select: light gray fill + black outline around selection block
- Heatmap column (see §2): the one place a coloured cell background is correct

### Buttons
- Primary: `--apex-ink` or `--apex-dark-green` fill, white text, 100px pill
- Secondary/outline: transparent, black text, 1px gray border
- Links: `--apex-dark-green`, underline on hover

### Sidebar (dashboard shell)
- Near-black (`--apex-sidebar`) background
- Idle nav item: white text at reduced opacity
- Active nav item: full-opacity white text + **lime** left-indicator bar — the only colour in the sidebar

### Workspace home (`/home`)
- Light top nav (white card bar, hairline bottom) — not the dark dashboard sidebar
- Property groups as white shadow cards, not bordered green-accent panels
- Shortcuts column: stacked white cards, not dark graphite/code aesthetic

## 5. Layout Principles

- **Generous, consistent air:** use the spacing scale — don't mix one-off pixel values
  - Between sections: `--apex-space-3xl` (80px) vertical padding
  - Between cards in a grid: `--apex-space-grid` (28px)
  - Inside cards: `--apex-space-card` (32px) padding on all sides
  - Between a heading and its body: `--apex-space-md` (16px) minimum
- Cards in a row align: same height, same top edge, consistent gutter
- Section headings at **weight 500**, black ink — clearly larger than body, not lighter/thinner
- Radius: 8px tags, 20px cards/panels, 14px inputs, 100px pills, 50% avatars

## 6. Depth & Elevation

| Level | Token | Use |
|---|---|---|
| Flat | none | Table rows at rest |
| Low | `--apex-shadow-low` | Default card |
| Mid | `--apex-shadow-mid` | Hover/active card, open dropdown |
| High | `--apex-shadow-high` | Modal, popover |

Hairlines are for dividers only — not for wrapping cards or charts.

## 7. Do's and Don'ts

### Do
- Default everything to grayscale; ask "does this color do a job?" before adding it
- Reserve brand colour for buttons, links, deltas, sparkline/chart strokes, and heatmap cells
- Keep KPI values black, not brand-coloured
- Use a single lime bar for the active nav item in the dashboard shell

### Don't
- Don't tint icon-chip backgrounds, card backgrounds, or full sections in beige/lime
- Don't use Cobalt green backgrounds anywhere in dashboard UI
- Don't use a coloured pill fill for status — prefer a small coloured dot + gray text
- Don't invent a new hex for the coral "bad" accent
- **Don't use `text-transform: uppercase`** on eyebrows, badges, pills, or section labels — sentence case only

## 8. Responsive Behavior

| Breakpoint | Width | Behavior |
|---|---|---|
| Mobile | <640px | Sidebar collapses to icon rail or bottom sheet; KPI grid stacks to 1 column; tables scroll horizontally |
| Tablet | 640–1024px | KPI grid at 2 columns; sidebar collapses to icon rail (56px) |
| Desktop | >1024px | Full sidebar (220px); KPI grid at 3–4 columns |

## 9. Agent Prompt Guide

- Default surface is white/near-white + black ink + gray hairline — brand colour is the exception, not the base
- Before adding a colour, name which of the four sanctioned slots it belongs to (button / link / delta / heatmap-or-chart-stroke). If it doesn't fit one, it's grayscale instead
- KPI tiles: black bold number, gray label, optional lime sparkline, text-only colored delta — no tinted chip backgrounds
- Status: small colored dot + gray text, not a colored pill fill
- Sidebar: black background, white text, one lime bar for the active item — nothing else colored
- Shared tokens live in `src/styles/apex-design-tokens.css`; static mockup in `design-preview.html`
- Section headings: weight **500**, sentence case — never uppercase for marketing labels
- Card padding: always `--apex-space-card`; section gaps: `--apex-space-3xl` / `--apex-space-grid`

---

## Migration tracker

| # | Area | Route / path | Status |
|---|---|---|---|
| — | Marketing landing | `/` | **Migrated** |
| 1 | Dashboard shell (sidebar + topbar) | `/dashboard/*`, parent-property layout | **Migrated** |
| 2 | Performance dashboard | `/dashboard/[id]/performance-dashboard` | **Migrated** |
| 3 | Daily overview | `/dashboard/[id]/daily-overview` | **Migrated** |
| 4 | Login | `/login` | **Migrated** |
| 5 | Workspace home | `/home` | **Migrated** |
| 6 | Analytics | `/dashboard/[id]/analytics` | **Migrated** |
| 7 | Ecommerce | `/dashboard/[id]/ecommerce` | **Migrated** |
| 8 | Markets overview | `/dashboard/[id]/markets-overview` | **Migrated** |
| 9 | Pace report | `/dashboard/[id]/tools/pace-report` | **Migrated** |
| 10 | P&L | `/dashboard/[id]/tools/pnl` | **Migrated** |
| 11 | Data wrapped | `/dashboard/[id]/data-wrapped` | **Migrated** |
| 12 | Share of search | `/dashboard/[id]/share-of-search` | **Migrated** |
| 13 | Campaign planner v2 | `/dashboard/[id]/campaign-planner-v2` | **Migrated** |
| 14 | Config | `/dashboard/[id]/config` | **Migrated** |
| 15 | Service dashboards | `/dashboard/[id]/service-dashboard/*` (SEO, PPC, Meta, Pinterest, Snapchat, Reddit, Bing, Bing Webmaster, EM) | **Migrated** |
| 16 | Parent property home | `/parent-property/[id]/home` | **Migrated** |
| 17 | Apex Radar | `/apex-radar/*` | **Migrated** |
| 18 | Standalone pages | `/profile`, `/news`, `/notifications`, `/our-tools`, `/lib/guides`, `/admin/*` | **Migrated** |
| 19 | Shared components | `DashboardHeading`, `DateRangePicker`, `MetricCard`, `GraphCard`, `CobaltLoader`, chart theme | **Migrated** |

## Known issue (tracked separately, not a design item)

The notes mention the Pace Report peaking at the start of the period — that's a data/logic bug in the reporting code, not a visual design question.

## Preview

A static, standalone mockup of this direction lives at `design-preview.html` in the project root — inline CSS/JS, no build step. Open directly in a browser without starting the dev server.
