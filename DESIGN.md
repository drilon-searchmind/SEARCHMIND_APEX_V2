# Design — Searchmind Apex

Locked design system for this app. Future Hallmark runs read this file first;
pages defer to it. Cobalt structure with **#213b34** as the primary colour.

## System

- **Genre** · modern-minimal
- **Macrostructure family**
  - Auth pages · Split Studio (form left · brand/code panel right)
  - App pages · Workbench (function carries the page — no enrichment)
- **Theme** · Cobalt (forest-green primary — replaces electric blue)
- **Axes** · light green-tinted paper / grotesk-sans / forest-green accent
- **`data-theme`** · `cobalt` on page roots
- **Primary anchor** · `#213b34`

## Colour palette

All UI colours are shades of `#213b34`. `tokens.css` is canonical — never use
the old Cobalt blue (`oklch(58% 0.20 256)`) or unrelated hues for accents.

| Role | Hex | Token |
|---|---|---|
| **Primary** | `#213b34` | `--color-primary`, `--color-accent`, `--color-ink`, `--color-focus` |
| Primary hover | `#1a302a` | `--color-accent-hover`, `--color-graphite` |
| Primary light | `#3d6b5e` | `--color-accent-light` (links, stars, syntax on dark) |
| Syntax key (dark panel) | `#9fd4b0` | `--color-syntax-key` (JSON keys, status chip) |
| On-primary text | `#f4f7f6` | `--color-accent-ink` |
| Body text | `#2d4a42` | `--color-ink-2` |
| Muted text | `#7a9489` | `--color-muted` |
| Secondary label | `#5c756a` | `--color-neutral` |
| Paper | `#f7f9f8` | `--color-paper` |
| Paper elevated | `#eef2f0` | `--color-paper-2` |
| Paper hover | `#e2e9e6` | `--color-paper-3` |
| Hairline | `#d4ddd9` | `--color-rule` |
| Border | `#a8bdb6` | `--color-rule-2` |
| Error | `#ee6251` | `--color-error` (unchanged — not in primary scale) |

### Usage rules

- **Primary buttons** · `--color-accent` fill, `--color-accent-ink` label
- **Button hover** · `--color-accent-hover` (darker shade)
- **Links & interactive highlights on light paper** · `--color-accent-light`
- **Eyebrows / mono labels** · `--color-accent` or `--color-accent-light`
- **Dark code panel** · `--color-graphite` background, `--color-accent-light` for status/syntax keys
- **Focus rings** · `--color-focus` (`#213b34`)

## Typography

- **Display** · Space Grotesk, weight 500–600
- **Body** · Inter, weight 400–500
- **Labels / code** · JetBrains Mono, uppercase eyebrows at `0.06em` tracking

```html
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
```

## Component voice

- Hairline borders (`--color-rule`, `--color-rule-2`)
- Radii · 6px inputs/buttons, 10px code cards
- Primary CTA · `#213b34` fill, light ink text
- Dark band · `#1a302a` graphite panel for code hero
- No pure `#000` / `#fff`

## Tokens (canonical · `tokens.css`)

```css
:root,
[data-theme="cobalt"] {
  --color-primary:      #213b34;
  --color-paper:        oklch(98% 0.006 165);
  --color-paper-2:      oklch(96% 0.008 165);
  --color-paper-3:      oklch(93% 0.01 165);
  --color-rule:         oklch(88% 0.012 165);
  --color-rule-2:       oklch(76% 0.02 165);
  --color-muted:        oklch(60% 0.03 165);
  --color-neutral:      oklch(50% 0.035 165);
  --color-ink-2:        oklch(32% 0.04 165);
  --color-ink:          oklch(27.5% 0.038 165);
  --color-accent:       oklch(27.5% 0.038 165);
  --color-accent-hover: oklch(22% 0.034 165);
  --color-accent-light: oklch(45% 0.055 165);
  --color-accent-ink:   oklch(98% 0.006 165);
  --color-focus:        oklch(27.5% 0.038 165);
  --color-graphite:     oklch(22% 0.034 165);
}
```

## CTA voice

- **Primary** · `#213b34` fill · `#f4f7f6` label · 6px radius
- **Secondary** · paper fill · `--color-rule-2` border · `--color-accent-light` border on hover

## Motion

- Easings · `--ease-out`, `--ease-in`
- Reduced-motion · opacity-only crossfade ≤ 150ms

## Exports

`tokens.css` at project root is the single source of truth. All page and
component CSS must reference tokens by name — never inline hex except in
`tokens.css` itself.

### shadcn/ui mapping

```css
:root {
  --background:         oklch(98% 0.006 165);
  --foreground:         oklch(27.5% 0.038 165);
  --primary:            oklch(27.5% 0.038 165);
  --primary-foreground: oklch(98% 0.006 165);
  --border:             oklch(88% 0.012 165);
  --ring:               oklch(27.5% 0.038 165);
  --radius:             6px;
}
```

## Implemented pages

- Login · `src/app/(auth)/login/`
- Public landing · `src/app/page.jsx` · `src/components/landing/`
- Home · `src/app/(protected)/home/`

## Notes

- Cobalt **structure** (Space Grotesk, hairlines, workbench layout, code card) is
  kept; only the accent hue changed from electric blue to `#213b34` green.
- Do not reintroduce blue accent values without amending this file.
