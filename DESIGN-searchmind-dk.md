# Design System Inspired by Searchmind ApS

> Auto-extracted from `https://searchmind.dk/` on 2026-06-17

## 1. Visual Theme & Atmosphere

Clean, minimal, and product-focused with deliberate use of whitespace.

The hero section leads with "Minding your business".

**Key Characteristics:**
- AcidGrotesk as the heading font
- AcidGrotesk as the body font for all running text
- Heading weight 400, letter-spacing 0.16px
- Light/white background (#fefbf2) as the primary canvas
- Primary accent `#c6ed62` used for CTAs and brand highlights
- 3 shadow level(s) detected — tinted shadows
- Moderate border-radius (12px) — balanced and professional
- Tags: light, soft, accented, sans-serif

## 2. Color Palette & Roles

### Primary
- **Primary Accent** (`#c6ed62`) · `--color-primary`: Brand color, CTA backgrounds, link text, interactive highlights.
- **Secondary Accent** (`#ee6251`) · `--color-secondary`: Secondary brand, hover states, complementary highlights.
- **Background** (`#fefbf2`) · `--color-bg`: Page background, primary canvas.
- **Background Secondary** (`#213b34`) · `--color-bg-secondary`: Cards, surfaces, alternating sections.

### Text
- **Text Primary** (`#1e2b2b`) · `--color-text`: Headings and body text.
- **Text Secondary** (`#a19986`) · `--color-text-secondary`: Muted text, captions, placeholders.

### Borders & Surfaces
- **Border** (`#1a2525`) · `--color-border`: Dividers, outlines, input borders.

### Full Extracted Palette

| # | Hex | CSS Variable | Role | Area | Contrast |
|---|---|---|---|---|---|
| 1 | `#1a2525` | `--palette-1` | badge | large | text-light |
| 2 | `#213b34` | `--palette-2` | block | large | text-light |
| 3 | `#c6ed62` | `--palette-3` | text-accent | large | text-dark |
| 4 | `#d6cdb6` | `--palette-4` | block | large | text-dark |
| 5 | `#6a8f4d` | `--palette-5` | block | large | text-light |
| 6 | `#a19986` | `--palette-6` | text-accent | small | text-dark |
| 7 | `#fefbf2` | `--palette-7` | badge | small | text-dark |
| 8 | `#eae3d1` | `--palette-8` | text-accent | small | text-dark |
| 9 | `#c5a75c` | `--palette-9` | text-accent | small | text-dark |
| 10 | `#ee6251` | `--palette-10` | text-accent | small | text-dark |
| 11 | `#953995` | `--palette-11` | text-accent | small | text-light |

## 3. Typography Rules

- **Heading Font:** `AcidGrotesk`, sans-serif
- **Body Font:** `AcidGrotesk`, sans-serif

### Type Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing |
|---|---|---|---|---|---|
| H1 | AcidGrotesk | 36px | 400 | 40px | 0.16px |
| H2 | AcidGrotesk | 30px | 400 | 37.5px | 0.16px |
| H3 | AcidGrotesk | 24px | 400 | 32px | 0.16px |
| H4 | AcidGrotesk | 20px | 400 | 28px | 0.16px |
| Body | AcidGrotesk | 11px | 500 | 14.6667px | 1.98px |
| Small | AcidGrotesk | 14px | 500 | 14px | 0.16px |

### Type Scale

| Token | Size | Suggested Usage |
|---|---|---|
| Display | `60px` | headings |
| H1 | `36px` | headings |
| H2 | `30px` | headings |
| H3 | `24px` | headings |
| H4 | `20px` | headings |
| Body L | `18px` | body / supporting text |
| Body | `16px` | body / supporting text |
| Small | `15px` | body / supporting text |
| XS | `14px` | body / supporting text |
| Caption | `12px` | body / supporting text |

## 4. Component Stylings

### Primary Button

```css
.btn-primary {
  background: #1a2525;
  color: #fefbf2;
  border-radius: 33554400px;
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  cursor: pointer;
}
```

### Pill Button

```css
.btn-pill {
  background: #c6ed62;
  color: #1a2525;
  border-radius: 33554400px;
  padding: 16px 24px;
  font-size: 15px;
  font-weight: 500;
  border: none;
  cursor: pointer;
}
```

### Filled Button

```css
.btn-filled {
  background: #1a2525;
  color: #1e2b2b;
  border-radius: 16px;
  padding: 0px 0px;
  font-size: 16px;
  font-weight: 400;
  border: none;
  cursor: pointer;
}
```

### Filled Button 2

```css
.btn-filled-2 {
  background: #1e2b2b;
  color: #1e2b2b;
  border-radius: 16px;
  padding: 0px 0px;
  font-size: 16px;
  font-weight: 400;
  border: none;
  cursor: pointer;
}
```

### Pill Button 2

```css
.btn-pill-2 {
  background: transparent;
  color: #1a2525;
  border-radius: 33554400px;
  padding: 0px 0px;
  font-size: 16px;
  font-weight: 400;
  border: 1px solid rgb(26, 37, 37);
  cursor: pointer;
}
```

### Pill Button 3

```css
.btn-pill-3 {
  background: transparent;
  color: #fefbf2;
  border-radius: 33554400px;
  padding: 0px 0px;
  font-size: 16px;
  font-weight: 400;
  border: 1px solid rgb(254, 251, 242);
  cursor: pointer;
}
```

### Card

```css
.card {
  background: #1a2525;
  border-radius: 16px;
  padding: 0px;
}
```

## 5. Layout Principles

- **Base spacing unit:** `10px` — use multiples (20px, 30px, 40px, etc.)

### Spacing Scale (extracted from real elements)

| Token | Value | Role |
|---|---|---|
| spacing-1 | `10px` | element |
| spacing-2 | `16px` | element |
| spacing-3 | `24px` | card |
| spacing-4 | `8px` | element |
| spacing-5 | `28px` | card |
| spacing-6 | `4px` | element |
| spacing-7 | `12px` | element |
| spacing-8 | `32px` | card |

### Border Radius Scale

| Token | Value | Element |
|---|---|---|
| radius-button | `12px` | button |
| radius-card | `16px` | card |
| radius-subtle | `4px` | subtle |
| radius-button | `8px` | button |
| radius-subtle | `1px` | subtle |
| radius-button | `6px` | button |

## 6. Depth & Elevation

| Level | Shadow | Usage |
|---|---|---|
| Low | `rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0...` | Cards, subtle elevation |
| Low | `rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0...` | Cards, subtle elevation |
| High | `rgba(0, 0, 0, 0.15) 0px 4px 16px 0px` | Modals, floating elements |


## 7. Do's and Don'ts

### Do
- Use `#fefbf2` as the primary background color
- Use `AcidGrotesk` for all headings and `AcidGrotesk` for body text
- Use `#c6ed62` as the single dominant accent/CTA color
- Maintain `10px` as the base spacing unit — all gaps should be multiples
- Apply the shadow system for elevation — use the extracted shadow values
- Use weight 400 for headings to match the brand's typographic voice

### Don't
- Don't use colors outside the extracted palette without justification
- Don't substitute AcidGrotesk/AcidGrotesk with generic alternatives
- Don't use irregular spacing — stick to 10px grid
- Don't use dark/black backgrounds — this is a light-themed design
- Don't use pure black (#000000) for text — use `#1e2b2b` instead
- Don't add decorative elements not present in the original design — no badges, ribbons, banners, or ornaments unless the source site uses them
- Don't invent UI patterns the source site doesn't have — if the original has no NEW badge, don't add one just because a red is in the palette

## 8. Responsive Behavior

| Breakpoint | Width | Notes |
|---|---|---|
| Mobile | < 640px | Single column, stack sections, reduce font sizes ~80% |
| Tablet | 640–1024px | 2-column where appropriate, maintain spacing ratios |
| Desktop | 1024–1440px | Full layout as designed |
| Wide | > 1440px | Max-width container, center content |

- Touch targets: minimum 44×44px on mobile
- Maintain 10px base unit across breakpoints — only scale multipliers

## 9. Agent Prompt Guide

### Quick Color Reference

```
Background:  #fefbf2
Text:        #1e2b2b
Accent:      #c6ed62
Secondary:   #ee6251
Border:      #1a2525
```

### Example Prompts

1. "Build a hero section with a `#fefbf2` background, `AcidGrotesk` heading in `#1e2b2b`, and a `#c6ed62` CTA button with 33554400px radius."
2. "Create a pricing card using background `#213b34`, border `#1a2525`, `AcidGrotesk` for text, and 30px padding."
3. "Design a navigation bar — `#fefbf2` background, `#1e2b2b` links, `#c6ed62` for active state."
4. "Build a feature grid with 3 columns, 30px gap, each card using the card component style."
5. "Create a footer with `#1e2b2b` background, `#fefbf2` text, and 20px padding."

### Iteration Guide

1. Start with layout structure (sections, grid, spacing)
2. Apply colors from the palette — background first, then text, then accents
3. Set typography — font families, sizes from the type scale, weights
4. Add components — buttons, cards, inputs using the specs above
5. Apply border-radius consistently across all elements
6. Add shadows for depth — use the extracted shadow values, not defaults
7. Check responsive behavior — test mobile and tablet layouts
8. Final pass — verify all colors match, spacing is consistent, fonts are correct

## 10. CSS Custom Properties

> 24 custom properties extracted from `:root` / `html` stylesheets.

### Color Variables

| Variable | Value |
|---|---|
| `--f-spinner-color-1` | `rgba(0, 0, 0, 0.1)` |
| `--f-spinner-color-2` | `rgba(17, 24, 28, 0.8)` |
| `--f-button-color` | `#374151` |
| `--f-button-bg` | `#f8f8f8` |
| `--f-button-hover-bg` | `#e0e0e0` |
| `--f-button-active-bg` | `#d0d0d0` |
| `--swiper-theme-color` | `#007aff` |

### Spacing Variables

| Variable | Value |
|---|---|
| `--f-spinner-width` | `36px` |
| `--f-spinner-height` | `36px` |
| `--f-spinner-stroke` | `2.75` |
| `--f-button-width` | `40px` |
| `--f-button-height` | `40px` |
| `--f-button-border` | `0` |
| `--f-button-border-radius` | `0` |
| `--f-button-svg-width` | `20px` |
| `--f-button-svg-height` | `20px` |
| `--f-button-svg-stroke-width` | `1.5` |
| `--f-button-svg-disabled-opacity` | `0.65` |
| `--swiper-navigation-size` | `44px` |

### Other Variables

| Variable | Value |
|---|---|
| `--f-button-shadow` | `none` |
| `--f-button-transition` | `all 0.15s ease` |
| `--f-button-transform` | `none` |
| `--f-button-svg-fill` | `none` |
| `--f-button-svg-filter` | `none` |
