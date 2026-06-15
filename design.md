# Argens — Design System

> Single source of truth for visual language, tokens, and component patterns across the Argens web app.  
> When in doubt about a colour, font size, or spacing value — check here first.

---

## Table of Contents

1. [Brand](#brand)
2. [Colour Tokens](#colour-tokens)
3. [Typography](#typography)
4. [Spacing & Layout](#spacing--layout)
5. [Border Radius](#border-radius)
6. [Elevation & Shadow](#elevation--shadow)
7. [Animations](#animations)
8. [Components](#components)
   - [Logo](#logo)
   - [Icon System](#icon-system)
   - [StatusBadge](#statusbadge)
   - [Inputs](#inputs)
   - [Buttons](#buttons)
   - [Cards & Surfaces](#cards--surfaces)
   - [Modals](#modals)
   - [Sidebar](#sidebar)
   - [TopBar](#topbar)
9. [Page Layouts](#page-layouts)
10. [Writing Style](#writing-style)

---

## Brand

### Mark

The Argens mark is two distinct gold forms rendered in SVG (`/public/argens-icon.svg`):

1. **Slash** — a thick diagonal bar running **NE → SW** (upper-right to lower-left), long axis at ~120° from horizontal. It occupies the upper-center-left of the composition (bar centre at ~35% across / 44% down of the mark's bounding box).
2. **Circle** — a gold circle with diameter ≈ 35.6% of the mark's width, positioned at the **lower-right corner** (centre at ~81% across / 77% down). There is a **large gap** (~29% of mark width) between the slash's right edge and the circle — these two forms do **not** touch.

The SVG bounding box is `51.75 × 54.75` — aspect ratio **0.9452:1** (slightly taller than wide, not square).

Neither element is ever recoloured. Do not apply filters, opacity, or colour overrides to the mark.  
**Never render in a square container** — always specify width and height separately to preserve the 0.9452 ratio.

```
/public/argens-icon.svg     — source, transparent background
/public/argens-icon.png     — 1024×1024 PNG, dark background (#0C0B0A)
/public/apple-icon.png      — 180×180 PNG for Apple touch icon
/public/favicon.ico         — multi-size ICO (16 / 32 / 48 / 256 px)
/app/icon.png               — Next.js App Router icon (1024×1024)
/app/apple-icon.png         — Next.js App Router Apple icon (180×180)
```

### Logotype

`Logo` component renders the mark + wordmark side-by-side:

| Size prop | Icon px | Font size |
|-----------|---------|-----------|
| `sm`      | 16      | 14        |
| `md`      | 20      | 18        |
| `lg`      | 22      | 22        |

Font: **DM Sans 700**, `letter-spacing: -0.025em`, colour `var(--text)`.  
Gap between mark and wordmark: `7px`.

### Voice in UI

- Use lowercase **argens** in prose. Title-case only in document titles.
- Never use "non-custodial" — always "agent-custodial".
- Amounts are always displayed as strings with currency suffix: `$10.50 USDC`, not `10.5`.

---

## Colour Tokens

All colours live in `globals.css` as CSS custom properties and are mirrored in `tailwind.config.ts`.  
**Never hardcode hex values in components.** Always reference `var(--token)`.

### Base Palette

| Token          | Hex                        | Usage                                              |
|----------------|----------------------------|----------------------------------------------------|
| `--bg`         | `#0C0B0A`                  | Page background, modal scrim target, form fields   |
| `--bg2`        | `#131210`                  | Card surface, sidebar, modal body                  |
| `--bg3`        | `#1C1916`                  | Inset surface (balance chip, code inset, thumbnails)|
| `--border`     | `#252220`                  | Default borders, dividers                          |
| `--border2`    | `#34302B`                  | Hover borders, stronger dividers, logo badge ring  |
| `--text`       | `#EDE9E3`                  | Primary text, headings, active nav items           |
| `--text2`      | `#B0A99F`                  | Secondary text, descriptions, labels               |
| `--muted`      | `#706B65`                  | Placeholder, inactive nav, sub-labels              |
| `--faint`      | `#403C38`                  | Tertiary — icon resting state, disabled hints      |
| `--accent`     | `#C5A253`                  | Brand gold — CTAs, active states, links            |
| `--accent-low` | `rgba(197,162,83, 0.10)`   | Accent tint fill — pill backgrounds, hover cells   |
| `--accent-mid` | `rgba(197,162,83, 0.28)`   | Accent border highlights, active pill borders      |

### Semantic Palette

| Token           | Hex                         | Usage                                  |
|-----------------|-----------------------------|----------------------------------------|
| `--success`     | `#4D9B6A`                   | SUCCESS badge, confirmation states     |
| `--success-low` | `rgba(77,155,106, 0.12)`    | Badge background fill                  |
| `--warning`     | `#B8832A`                   | PENDING / warning states               |
| `--warning-low` | `rgba(184,131,42, 0.12)`    | Badge background fill                  |
| `--error`       | `#A04848`                   | BLOCKED / REJECTED / FAILED badge      |
| `--error-low`   | `rgba(160,72,72, 0.12)`     | Badge background fill, error banners   |
| `--pending`     | `#6B7FAF`                   | PENDING_APPROVAL badge                 |
| `--pending-low` | `rgba(107,127,175, 0.12)`   | Badge background fill                  |

### Inline colour objects (landing page / showcase)

Pages that use inline `style={{}}` objects declare a local `t` object matching the CSS tokens above.  
This is intentional — those pages are self-contained. Do not change the hex values without updating `globals.css` at the same time.

```typescript
const t = {
  bg:        '#0C0B0A',
  bg2:       '#131210',
  bg3:       '#1C1916',
  border:    '#252220',
  border2:   '#34302B',
  text:      '#EDE9E3',
  text2:     '#B0A99F',
  muted:     '#706B65',
  faint:     '#403C38',
  accent:    '#C5A253',
  accentLow: 'rgba(197,162,83,0.10)',
  accentMid: 'rgba(197,162,83,0.28)',
}
```

---

## Typography

Three font families. Loaded from Google Fonts in `globals.css`.

| Role       | Family                        | CSS variable      | Weights used   |
|------------|-------------------------------|-------------------|----------------|
| Heading    | DM Sans                 | `var(--font-head)`| 400, 500, 600, 700 |
| Body       | Inter                         | `var(--font-body)`| 400, 500, 600  |
| Monospace  | JetBrains Mono                | `var(--font-mono)`| 400, 500       |

### Scale reference

| Role                    | Font            | Size   | Weight | Tracking        |
|-------------------------|-----------------|--------|--------|-----------------|
| Display / hero          | DM Sans   | 48–64px| 700    | `-0.03em`       |
| Page heading (H1)       | DM Sans   | 32–40px| 700    | `-0.03em`       |
| Card heading / TopBar   | DM Sans   | 18px   | 600    | `-0.015em`      |
| Section label           | DM Sans   | 16–17px| 600–700| `-0.01em`       |
| Body text               | Inter           | 13–14px| 400    | `normal`        |
| Secondary body          | Inter           | 13px   | 400    | `normal`        |
| Mono label / code       | JetBrains Mono  | 11–13px| 400    | `0.02–0.06em`   |
| Uppercase tag / badge   | JetBrains Mono  | 10–11px| 400–500| `0.04–0.10em`   |
| Balance display         | DM Sans   | 20px   | 700    | `-0.02em`       |
| Large balance / stat    | DM Sans   | 28–32px| 700    | `-0.03em`       |

### Rules

- Page `font-size` base: `16px`. `line-height: 1.6`.
- `-webkit-font-smoothing: antialiased` on `html`.
- Uppercase text always uses JetBrains Mono + `letter-spacing: 0.06em+`.
- `letter-spacing` is always negative on DM Sans headings — this is intentional and should not be removed.

---

## Spacing & Layout

### Grid

Dashboard layout: `display: flex`, `flex-direction: row`.  
Sidebar: `width: 220px`, `flex-shrink: 0`, `height: 100vh`, `position: sticky`, `top: 0`.  
Main area: `flex: 1`, `overflow-y: auto`.

### Padding conventions

| Context                     | Padding                     |
|-----------------------------|-----------------------------|
| Sidebar header block        | `20px 16px 12px`            |
| Sidebar nav area            | `10px 8px`                  |
| Nav item                    | `8px 10px`                  |
| TopBar                      | `20px 32px`                 |
| Dashboard main content      | `32px`                      |
| Card / surface              | `20–28px`                   |
| Modal body                  | `28px`                      |
| Modal inner code block      | `12px 14px`                 |
| Input                       | `10px 12px`                 |
| Button (primary)            | `11px` vertical             |
| Button (secondary/small)    | `8px 14px`                  |
| Tag / pill                  | `3–6px 10–14px`             |
| Auth card                   | `28px 28px 24px`            |
| Auth layout                 | Centred column, `max-width: 400px` |

### Gap

- Flex row gaps in nav: `10px` (icon + label), `20px` (nav items).
- Form stacks: `gap: 16px`.
- Button rows: `gap: 8px`.
- Dashboard stat rows: `gap: 16–24px`.

---

## Border Radius

| Token / usage               | Value  |
|-----------------------------|--------|
| Default (inputs, tags)      | `6px`  |
| Card, modal, sidebar chip   | `10–12px` |
| Modal outer container       | `14px` |
| Showcase card               | `12px` |
| Logo badge                  | `10px` |
| Pill / tag (fully round)    | `20px` |
| Avatar initials circle      | `50%`  |
| Status dot                  | `50%`  |
| Badge                       | `4px`  |

---

## Elevation & Shadow

Argens uses **dark-mode shadows** — shadow colour is always `rgba(0,0,0,N)`, never a light or coloured shadow.

| Context                  | Shadow                                                 |
|--------------------------|--------------------------------------------------------|
| Card resting             | `0 2px 8px rgba(0,0,0,0.20)`                          |
| Card hovered             | `0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px <border2>`   |
| Modal container          | `0 24px 64px rgba(0,0,0,0.60)`                        |
| Logo badge               | `0 2px 8px rgba(0,0,0,0.40)`                          |
| Modal scrim              | `rgba(0,0,0,0.72)` full-screen overlay                |

Hover shadows transition: `box-shadow 0.22s cubic-bezier(0.16,1,0.3,1)`.

---

## Animations

Defined in `globals.css`. Use the class names, not duplicate `@keyframes`.

| Class / keyframe   | Effect                              | Usage                              |
|--------------------|-------------------------------------|------------------------------------|
| `fadeInUp`         | `opacity 0→1`, `translateY 6px→0`  | Page section entrance, modal open  |
| `animate-fade-in-up` (utility) | Applies `fadeInUp 0.2s ease-out` | Prefixes any entering element |
| `glow`             | Opacity pulse + box-shadow glow     | Warning/alert states               |
| `dotPulse`         | Scale 0.85→1, opacity 0.25→1       | Loading dots                       |
| `blink`            | Opacity 1→0 (step-end)             | Cursor in terminal-style blocks    |
| `cursor-blink`     | Applies `blink 1s step-end infinite`, `color: var(--accent)` | Blinking cursor |

Card hover transitions: `border-color 0.15s`, `box-shadow 0.22s cubic-bezier(0.16,1,0.3,1)`.  
Image zoom on card hover: `transform: scale(1.04)` with `transition: transform 0.4s cubic-bezier(0.16,1,0.3,1)`.  
Nav item transitions: `all 0.12s`.  
Colour/opacity micro-transitions: `0.15s`.  
Expand/collapse (how-we-used section): `max-height 0.32s cubic-bezier(0.16,1,0.3,1), opacity 0.22s ease`.

---

## Components

### Logo

`components/ui/Logo.tsx` — accepts `size` (`sm` | `md` | `lg`) and `href`.  
Renders `<Link>` containing `<Image src="/argens-icon.svg">` + `<span>argens</span>`.

```tsx
<Logo />                      // md, links to /
<Logo size="lg" />            // larger, same link
<Logo size="md" href="/dashboard" />  // dashboard variant
```

### Icon System

`components/dashboard/Icon.tsx` exports `<Icon d={...} size={N} />` and the `Icons` constant.  
All icons draw on a `16×16` viewBox with `stroke="currentColor"`, `strokeWidth="1.4"`, round caps/joins.  
Colour is always set on the parent via `color:` — never hardcoded inside the SVG.

Available icon keys:
`overview`, `wallet`, `policies`, `transactions`, `analytics`, `marketplace`, `apikeys`, `settings`,
`arrow`, `copy`, `eye`, `eyeoff`, `refresh`, `check`, `x`, `search`, `filter`, `chevrondown`, `plus`, `logout`.

Usage:
```tsx
<Icon d={Icons.wallet} size={14} />
<Icon d={Icons.check} size={16} style={{ color: 'var(--success)' }} />
```

### StatusBadge

`components/ui/Badge.tsx` — maps transaction status strings to coloured pill badges.

| Status string     | Colour token    | Label      |
|-------------------|-----------------|------------|
| `SUCCESS`         | `--success`     | SUCCESS    |
| `CONFIRMED`       | `--success`     | CONFIRMED  |
| `APPROVED`        | `--success`     | APPROVED   |
| `BLOCKED`         | `--error`       | BLOCKED    |
| `REJECTED`        | `--error`       | REJECTED   |
| `FAILED`          | `--error`       | FAILED     |
| `PENDING_APPROVAL`| `--pending`     | PENDING    |
| *(unknown)*       | `--warning`     | *(raw str)*|

Shape: `font-mono`, `10px`, `font-weight 500`, `letter-spacing 0.04em`, `padding: 2px 7px`, `border-radius: 4px`.  
Always includes a 5×5px dot in `background: currentColor` at the left of the label.

```tsx
<StatusBadge status="SUCCESS" />
<StatusBadge status="PENDING_APPROVAL" />
```

### Inputs

Pattern extracted from auth pages and wallet send form:

```css
background: var(--bg);
border: 1px solid var(--border2);
border-radius: 7px;
padding: 10px 12px;
font-family: var(--font-mono);
font-size: 13px;
color: var(--text);
outline: none;
transition: border-color 0.15s;
```

Focus: `border-color: var(--accent)` — applied via `onFocus` / `onBlur` handlers (no `:focus` pseudo-class because of inline styles).  
Labels: `font-mono`, `12px`, `letter-spacing: 0.06em`, `text-transform: uppercase`, `color: var(--muted)`, `margin-bottom: 6px`.  
Error banner inside form card:
```css
background: var(--error-low);
border: 1px solid rgba(160,72,72,0.3);
border-radius: 7px;
color: var(--error);
font-family: var(--font-mono);
font-size: 13px;
padding: 10px 14px;
margin-bottom: 20px;
```

`PasswordInput` (`components/ui/PasswordInput.tsx`) — wraps a standard input with an eye-toggle button.

### Buttons

**Primary (accent fill):**
```css
background: var(--accent);
color: #0C0B0A;              /* dark on gold */
border: none;
border-radius: 7px;
padding: 11px;
font-family: var(--font-head);
font-size: 14px;
font-weight: 600;
letter-spacing: -0.01em;
cursor: pointer;
transition: all 0.15s;
```
Disabled state: `background: var(--bg3)`, `color: var(--muted)`, `cursor: not-allowed`.

**Secondary (outlined):**
```css
background: transparent;
border: 1px solid var(--border2);
border-radius: 6–7px;
color: var(--muted);
font-family: var(--font-mono);   /* or --font-body */
font-size: 12–13px;
padding: 8px 14px;
cursor: pointer;
```

**Ghost / icon button:**
```css
background: transparent;
border: none;
color: var(--faint);
cursor: pointer;
padding: 4px;
border-radius: 4px;
transition: color 0.15s;
```
Hover: `color: var(--error)` (logout) or `color: var(--text2)` (generic).

**CTA link (landing/showcase):**
```css
/* Accent filled */
background: var(--accent);
color: var(--bg);
border-radius: 7–8px;
padding: 10px 22px;
font-family: var(--font-head);
font-size: 13px;
font-weight: 600;
text-decoration: none;
```

### Cards & Surfaces

Base card:
```css
background: var(--bg2);
border: 1px solid var(--border);
border-radius: 12px;
```

Hover card (showcase):
```css
border-color: var(--border2);
box-shadow: 0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px var(--border2);
transition: box-shadow 0.22s cubic-bezier(0.16,1,0.3,1), border-color 0.15s;
```

Inset surface (balance chip, code block, instructions):
```css
background: var(--bg3);           /* or var(--bg) for slightly lighter */
border: 1px solid var(--border);
border-radius: 7–8px;
```

Dividers:
```css
height: 1px;
background: var(--border);
```

Floating label pattern (separator with text):
```jsx
<div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
<span style={{ fontSize: 11, color: 'var(--faint)', fontFamily: 'var(--font-mono)' }}>label</span>
<div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
```

### Modals

Scrim: `position: fixed`, `inset: 0`, `background: rgba(0,0,0,0.72)`, `z-index: 500`, flex-centered.  
Click-outside closes (click on scrim calls `onClose`; click on modal body calls `e.stopPropagation()`).

Container:
```css
background: var(--bg2);
border: 1px solid var(--border2);
border-radius: 14px;
padding: 28px;
width: 420px;
box-shadow: 0 24px 64px rgba(0,0,0,0.60);
```

Modal title: `font-head`, `17px`, `font-weight 600`, `margin-bottom: 4px`.  
Modal subtitle: `13px`, `color: var(--muted)`, `margin-bottom: 22px`.

### Sidebar

`components/dashboard/Sidebar.tsx`

- Width: `220px`, `height: 100vh`, `position: sticky; top: 0`, scrollable.
- Background: `var(--bg2)`, right border: `1px solid var(--border)`.
- Three zones: header (logo + balance chip), nav, user footer.

**Active nav item:**
```css
background: var(--bg3);
color: var(--text);
font-weight: 500;
border-left: 2px solid var(--accent);
```
**Inactive nav item:**
```css
background: transparent;
color: var(--muted);
font-weight: 400;
border-left: 2px solid transparent;
```
Icon on active: `color: var(--accent)`. Icon on inactive: `color: var(--faint)`.

**Balance chip inside sidebar header:**
```css
background: var(--bg3);
border-radius: 7px;
border: 1px solid var(--border);
padding: 10px 12px;
```
Label: `font-mono`, `10px`, `letter-spacing: 0.06em`, `uppercase`, `color: var(--muted)`.  
Amount: `font-head`, `20px`, `font-weight: 700`, `letter-spacing: -0.02em`.  
Sub-line: `11px`, `color: var(--muted)`.

### TopBar

`components/dashboard/TopBar.tsx`

```css
padding: 20px 32px;
border-bottom: 1px solid var(--border);
background: var(--bg);
position: sticky;
top: 0;
z-index: 10;
```

Title: `font-head`, `18px`, `font-weight: 600`, `letter-spacing: -0.015em`.  
Subtitle: `13px`, `color: var(--muted)`, `margin-top: 2px`.  
Actions slot: flex row, `gap: 8px`, right-aligned.

---

## Page Layouts

### Landing page

Full-width, `background: var(--bg)`. Fixed nav (height `58px`, blur backdrop).  
Content sections stacked vertically with generous vertical padding (`clamp(64px, 10vw, 120px)`).  
Max content width: `1160px`, centred with `margin: 0 auto` and `padding: 0 clamp(20px, 4vw, 40px)`.  
Radial gold glow: `radial-gradient(ellipse at 50% 0%, rgba(197,162,83,0.09) 0%, transparent 70%)` — decorative, pointer-events none, overflow hidden.

### Auth pages

Centred vertically and horizontally inside the viewport.  
Content column: `max-width: 400px`, `width: 100%`.  
Logo centred above the card, `margin-bottom: 32px`.  
Auth card: `background: var(--bg2)`, `border: 1px solid var(--border)`, `border-radius: 12px`, `padding: 28px 28px 24px`.

### Dashboard pages

Horizontal split: `<Sidebar>` (220px fixed) + `<main>` (flex: 1).  
Each dashboard page starts with `<TopBar title="..." subtitle="..." actions={...} />`.  
Main content inside: `padding: 32px`, or contained in narrower `max-width` columns for forms.

### Showcase page

Same nav structure as landing. Header centred. Grid: 3 columns (desktop), 2 columns (tablet), 1 column (mobile).  
Tag filter bar: flex wrap, `gap: 8px`, pill buttons.

---

## Writing Style

- **Labels**: monospace uppercase (`font-mono`, `10–11px`, `letter-spacing: 0.06em`). Used for field labels, sidebar section headers, badge text.
- **Amounts**: always show 2 decimal places in UI (`$10.50`). API uses 7 decimal places internally — never expose the 7-decimal raw string to end users unless it's in a code block.
- **Loading states**: use an em-dash `—` for numeric values not yet loaded. Use `Loading…` (with ellipsis) for text placeholders.
- **Error messages**: plain English, mono font, inside `var(--error-low)` banner. Never expose raw API error codes to users — translate them.
- **External links**: always `target="_blank" rel="noopener noreferrer"`. Use `↗` icon suffix or the `arrow` icon (14px) styled `color: var(--muted)`.
- **Copy/confirm**: on copy success, swap label to `✓ Copied` in `var(--success)`, auto-revert after 1800ms.
- **Tone**: direct, technical, minimal. No exclamation marks in dashboard UI. Reserve friendly phrasing for empty states and onboarding.
