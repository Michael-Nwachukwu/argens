---
# frame.md — Argens, the frame layer
# atoms are sacred · composition is free · numbers come from the script

colors:
  # base palette — verbatim from design.md
  bg:          "#0C0B0A"   # page ground, modal scrim target
  bg2:         "#131210"   # card surface, sidebar, modal body
  bg3:         "#1C1916"   # inset surface (balance chip, code inset)
  border:      "#252220"   # default borders, dividers
  border2:     "#34302B"   # hover borders, logo badge ring
  text:        "#EDE9E3"   # primary text, headings
  text2:       "#B0A99F"   # secondary text
  muted:       "#706B65"   # placeholder, inactive nav
  faint:       "#403C38"   # tertiary, disabled hints
  accent:      "#C5A253"   # brand gold — CTAs, active states
  accent-low:  "rgba(197,162,83,0.10)"
  accent-mid:  "rgba(197,162,83,0.28)"

  # semantic — verbatim
  success:     "#4D9B6A"
  success-low: "rgba(77,155,106,0.12)"
  warning:     "#B8832A"
  warning-low: "rgba(184,131,42,0.12)"
  error:       "#A04848"
  error-low:   "rgba(160,72,72,0.12)"
  pending:     "#6B7FAF"
  pending-low: "rgba(107,127,175,0.12)"

typography:
  fonts:
    head: "Space Grotesk"           # 400 / 500 / 600 / 700
    body: "Inter"                   # 400 / 500 / 600
    mono: "JetBrains Mono"          # 400 / 500

  # reading ramp — from design.md (px), retained for chrome / colophon
  reading:
    display-px:        { fontFamily: "{typography.fonts.head}", fontSize: 64px, fontWeight: 700, letterSpacing: "-0.03em" }
    h1-px:             { fontFamily: "{typography.fonts.head}", fontSize: 40px, fontWeight: 700, letterSpacing: "-0.03em" }
    card-heading-px:   { fontFamily: "{typography.fonts.head}", fontSize: 18px, fontWeight: 600, letterSpacing: "-0.015em" }
    section-label-px:  { fontFamily: "{typography.fonts.head}", fontSize: 17px, fontWeight: 700, letterSpacing: "-0.01em" }
    body-px:           { fontFamily: "{typography.fonts.body}", fontSize: 14px, fontWeight: 400, lineHeight: 1.6 }
    body-sec-px:       { fontFamily: "{typography.fonts.body}", fontSize: 13px, fontWeight: 400 }
    mono-px:           { fontFamily: "{typography.fonts.mono}", fontSize: 12px, fontWeight: 400, letterSpacing: "0.04em" }
    badge-mono-px:     { fontFamily: "{typography.fonts.mono}", fontSize: 10px, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }
    balance-px:        { fontFamily: "{typography.fonts.head}", fontSize: 20px, fontWeight: 700, letterSpacing: "-0.02em" }
    stat-px:           { fontFamily: "{typography.fonts.head}", fontSize: 32px, fontWeight: 700, letterSpacing: "-0.03em" }

  # display / hero ramp — frame-native (vw against 1920; showcase mirrors as cqw)
  hero:
    wordmark-mega:     { fontFamily: "{typography.fonts.head}", fontSize: 30vw, fontWeight: 700, lineHeight: 0.84, letterSpacing: "-1.9vw" }
    display-hero:      { fontFamily: "{typography.fonts.head}", fontSize: 14vw, fontWeight: 700, lineHeight: 0.92, letterSpacing: "-0.45vw" }
    claim-large:       { fontFamily: "{typography.fonts.head}", fontSize: 9vw,  fontWeight: 700, lineHeight: 0.96, letterSpacing: "-0.27vw" }
    stat-numeral:      { fontFamily: "{typography.fonts.head}", fontSize: 11vw, fontWeight: 700, lineHeight: 0.92, letterSpacing: "-0.33vw" }
    stat-ledger:       { fontFamily: "{typography.fonts.head}", fontSize: 2.6vw, fontWeight: 700, lineHeight: 1.0, letterSpacing: "-0.05vw" }
    section-head:      { fontFamily: "{typography.fonts.head}", fontSize: 4.2vw, fontWeight: 600, lineHeight: 1.0, letterSpacing: "-0.06vw" }
    pill-giant:        { fontFamily: "{typography.fonts.head}", fontSize: 2.4vw, fontWeight: 600, lineHeight: 1.0, letterSpacing: "-0.02vw" }
    body-frame:        { fontFamily: "{typography.fonts.body}", fontSize: 1.6vw, fontWeight: 400, lineHeight: 1.5 }
    mono-frame:        { fontFamily: "{typography.fonts.mono}", fontSize: 1.4vw, fontWeight: 400, letterSpacing: "0.06em", textTransform: "uppercase" }
    badge-mono-frame:  { fontFamily: "{typography.fonts.mono}", fontSize: 1.4vw, fontWeight: 500, letterSpacing: "0.10em", textTransform: "uppercase" }

rounded:
  default:        6px       # inputs, tags
  card:           12px      # card, modal body
  modal-outer:    14px
  showcase-card:  12px
  logo-badge:     10px
  pill:           20px      # fully round
  circle:         50%       # avatar, status dot
  badge:          4px
  input:          7px
  button:         7px

spacing:
  # verbatim chrome paddings (px)
  sidebar-header:    "20px 16px 12px"
  sidebar-nav:       "10px 8px"
  nav-item:          "8px 10px"
  topbar:            "20px 32px"
  dashboard-main:    32px
  card:              24px
  modal-body:        28px
  input:             "10px 12px"
  button-primary:    "11px 22px"
  button-secondary:  "8px 14px"
  pill:              "4px 12px"
  # frame-scale paddings (vw)
  frame-pad:         5vw          # default safe-area inset
  frame-pad-tight:   3.5vw        # ledger / catalog
  gap-frame:         2vw
  gap-stack:         1vw

shadows:
  card-rest:    "0 2px 8px rgba(0,0,0,0.20)"
  card-hover:   "0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px {colors.border2}"
  modal:        "0 24px 64px rgba(0,0,0,0.60)"
  logo-badge:   "0 2px 8px rgba(0,0,0,0.40)"
  scrim:        "rgba(0,0,0,0.72)"

components:
  # ── identity atoms ────────────────────────────────────────────
  logo-mark:
    # Two distinct gold forms — never described as a pill or connected shape:
    #   1. Slash — a thick diagonal bar running NE → SW (upper-right to lower-left),
    #              long axis at ~120° from horizontal; occupies the upper-center-left of the mark;
    #              bar centre sits at roughly 35% across / 44% down of the total bounding box.
    #   2. Circle — a gold circle (diameter ≈ 35.6% of mark width) sitting at the lower-right corner;
    #               centre at ~81% across / 77% down; there is a large gap (~29% of mark width)
    #               between the slash's right edge and the circle — the two forms do NOT touch.
    # SVG viewBox: 51.75 × 54.75 — aspect ratio 0.9452 ∶ 1 (slightly taller than wide, not square).
    # NEVER render in a square container or apply objectFit:cover — this stretches the mark.
    width:  1.6vw
    height: 1.693vw     # = 1.6 × (54.75 / 51.75) — preserve the 0.9452 ratio
    fill:   "{colors.accent}"
    note:   "verbatim SVG — no filters, opacity, hue shifts, or container squashing"
  logo-mark-giant:
    composes: "{components.logo-mark}"
    width:  9vw
    height: 9.52vw      # = 9 × (54.75 / 51.75)
  wordmark:
    typography: "{typography.reading.section-label-px}"
    textColor:  "{colors.text}"
    gap-to-mark: 7px
  wordmark-frame:
    typography: "{typography.hero.section-head}"
    textColor:  "{colors.text}"
    gap-to-mark: 0.6vw
  wordmark-mega:
    typography: "{typography.hero.wordmark-mega}"
    textColor:  "{colors.text}"

  # ── interactive ───────────────────────────────────────────────
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor:       "{colors.bg}"
    typography:      "{typography.reading.card-heading-px}"
    rounded:         "{rounded.button}"
    padding:         "{spacing.button-primary}"
  button-primary-giant:
    composes: "{components.button-primary}"
    typography: "{typography.hero.pill-giant}"
    rounded:    "{rounded.pill}"
    padding:    "1.2vw 3vw"
  button-secondary:
    backgroundColor: "transparent"
    textColor:       "{colors.muted}"
    typography:      "{typography.reading.mono-px}"
    border:          "1px solid {colors.border2}"
    rounded:         "{rounded.button}"
    padding:         "{spacing.button-secondary}"
  button-secondary-frame:
    composes: "{components.button-secondary}"
    typography: "{typography.hero.mono-frame}"
    padding:    "0.7vw 1.4vw"

  # ── chrome ─────────────────────────────────────────────────────
  mono-label:
    typography: "{typography.hero.mono-frame}"
    textColor:  "{colors.muted}"
  mono-label-faint:
    composes: "{components.mono-label}"
    textColor: "{colors.faint}"
  index-numeral:
    typography: "{typography.hero.mono-frame}"
    textColor:  "{colors.accent}"
    note: "the gold mono index used to letterpress-rule sections"

  # ── data atoms ────────────────────────────────────────────────
  amount-string:
    # "$10.50 USDC" — always 2dp, currency suffix, never bare number
    typography:    "{typography.hero.stat-numeral}"
    textColor:     "{colors.text}"
    suffix-token:  "{components.mono-label}"
    note: "string format mandatory; em-dash — when value not yet loaded"
  balance-chip:
    backgroundColor: "{colors.bg3}"
    border:          "1px solid {colors.border}"
    rounded:         "{rounded.input}"
    padding:         "10px 12px"
    label-typography: "{typography.reading.badge-mono-px}"
    amount-typography: "{typography.reading.balance-px}"
  balance-chip-giant:
    backgroundColor: "{colors.bg3}"
    border:          "1px solid {colors.border}"
    rounded:         "{rounded.card}"
    padding:         "2.4vw 2.8vw"
    label-typography: "{typography.hero.badge-mono-frame}"
    amount-typography: "{typography.hero.stat-numeral}"
  status-badge:
    # pill: dot + uppercase mono label, tinted background
    typography: "{typography.reading.badge-mono-px}"
    rounded:    "{rounded.badge}"
    padding:    "2px 7px"
    dot-size:   "5px"
    variants:
      success:  { backgroundColor: "{colors.success-low}", textColor: "{colors.success}" }
      error:    { backgroundColor: "{colors.error-low}",   textColor: "{colors.error}"   }
      pending:  { backgroundColor: "{colors.pending-low}", textColor: "{colors.pending}" }
      warning:  { backgroundColor: "{colors.warning-low}", textColor: "{colors.warning}" }
  status-badge-frame:
    composes: "{components.status-badge}"
    typography: "{typography.hero.badge-mono-frame}"
    padding:    "0.4vw 1vw"
    dot-size:   "0.7vw"

  # ── surfaces ──────────────────────────────────────────────────
  card-surface:
    backgroundColor: "{colors.bg2}"
    border:          "1px solid {colors.border}"
    rounded:         "{rounded.card}"
    padding:         "{spacing.card}"
    shadow:          "{shadows.card-rest}"
  inset-surface:
    backgroundColor: "{colors.bg3}"
    border:          "1px solid {colors.border}"
    rounded:         "{rounded.input}"
    padding:         "1vw 1.2vw"
  divider:
    backgroundColor: "{colors.border}"
    height:          "1px"
  divider-labeled:
    composes: "{components.divider}"
    label-typography: "{typography.hero.mono-frame}"
    label-color: "{colors.faint}"
    note: "rule — label — rule, flex row, gap 1vw"
  modal:
    backgroundColor: "{colors.bg2}"
    border:          "1px solid {colors.border2}"
    rounded:         "{rounded.modal-outer}"
    padding:         "{spacing.modal-body}"
    shadow:          "{shadows.modal}"

  # ── nav / chrome (web atoms; appear only in the establishing frame) ─
  sidebar:
    backgroundColor: "{colors.bg2}"
    border-right:    "1px solid {colors.border}"
    width:           "11.46vw"   # 220 / 1920
    padding:         "{spacing.sidebar-header}"
  topbar:
    backgroundColor: "{colors.bg}"
    border-bottom:   "1px solid {colors.border}"
    padding:         "{spacing.topbar}"
    title-typography: "{typography.reading.card-heading-px}"
  nav-item-active:
    backgroundColor: "{colors.bg3}"
    textColor:       "{colors.text}"
    border-left:     "2px solid {colors.accent}"
    padding:         "{spacing.nav-item}"
  nav-item-inactive:
    backgroundColor: "transparent"
    textColor:       "{colors.muted}"
    border-left:     "2px solid transparent"
    padding:         "{spacing.nav-item}"

  # ── ledger row ────────────────────────────────────────────────
  ledger-row:
    backgroundColor: "transparent"
    border-bottom:   "1px solid {colors.border}"
    padding:         "1.2vw 0"
    height-typography: "{typography.hero.stat-ledger}"
    label-typography:  "{typography.hero.mono-frame}"
---

# Argens — frame.md

> **atoms are sacred · composition is free · numbers come from the script.**

A video-first companion to `design.md`. Argens is an **agent-custodial** crypto-treasury brand: deep neutral grounds, a single gold voltage rationed across the frame, mono-uppercase labels, and amounts written as strings (`$10.50 USDC`, never `10.5`). The frame becomes the unit; the gold becomes scarce; the wordmark becomes monumental.

## Overview

Argens at frame scale is **dark, precise, and laconic**. The page ground (`{colors.bg}` #0C0B0A) carries 80–90% of pixels; gold (`{colors.accent}` #C5A253) is the brand's only voltage and fires **once per frame** — a slash, a pill, an active rule, a numeral. Headings sit in Space Grotesk with negative tracking; labels sit in JetBrains Mono with +0.06em uppercase tracking. There is no second hue. There is no decorative gradient (the radial gold glow from the landing page is a chrome flourish, not a frame motif).

### Frame Craft Bar

- **Squint test** — one element dominates at **3–6× its nearest neighbour**. The wordmark, the numeral, the slash. Not a ramp of three roughly-equal things.
- **Silence test** — sparse archetypes (cover, claim, stat, closer) read **55–75% empty**. The ledger plate is the **named density exception**; everything else breathes.
- **Restraint test** — gold fires **once at full saturation**. A second gold element drops to `{colors.accent-low}` or `{colors.accent-mid}`. Two full-strength golds in the same frame is a failure.
- **Reference bar** — aim at a Bloomberg Terminal end-card or a Stripe Sessions keynote plate. Failure mode: a generic crypto-bro hero with a glowing coin and a duplicate CTA pair.

## Colors

Tokens carry verbatim. At frame scale they obey three rules:

1. **Grounds are neutrals.** `{colors.bg}` is the default frame ground; `{colors.bg2}` is reserved for one floated surface; `{colors.bg3}` for an inset within that surface. Never use gold as a frame ground.
2. **Gold is rationed.** One full-strength `{colors.accent}` placement per frame — the slash motif, an active rule, a single numeral, or a single pill. Echoes use `{colors.accent-low}` (tint) or `{colors.accent-mid}` (border). The radial glow from `globals.css` is forbidden at frame scale; it reads as a hot spot in video.
3. **Semantics are chrome-only.** `{colors.success}` / `{colors.error}` / `{colors.pending}` / `{colors.warning}` appear **only** as `{components.status-badge-frame}`. They never colour text, headlines, or grounds.

## Typography

Two ramps. The reading ramp from `design.md` survives for chrome and colophon; the **hero ramp** (`{typography.hero}`) is the frame's working register.

- **Headings — Space Grotesk.** Negative tracking is non-negotiable; it is how the wordmark coheres at 30vw.
- **Body — Inter, 1.6vw / 1.5 line-height.**
- **Mono — JetBrains Mono.** Always uppercase, always tracked ≥0.06em. This is the brand's label voice — sidebar headers, badge text, kicker eyebrows.
- **Legibility floor — 1.4vw (≈27px @1920).** Any load-bearing line meets the floor. Sizes below 1.4vw are colophon / footnote only and may never carry a beat's meaning.
- **Fit-to-measure.** Headline text-blocks cap at **78vw wide**. Step the hero ramp by word count: ≤3 words → `{typography.hero.display-hero}`; 4–6 → `{typography.hero.claim-large}`; 7+ → `{typography.hero.section-head}`.

## Layout — The Frame

- **Primary**: 1920 × 1080 (16:9). **Companions**: 1080 × 1920 (9:16), 1080 × 1080 (1:1).
- **Safe area**: `{spacing.frame-pad}` (5vw, ≈96px @1920) on every edge. The dense ledger plate may use `{spacing.frame-pad-tight}` (3.5vw).
- **Vw law** — every display size, padding, and gap a treatment names is `vw` and resolves against the frame's container width. Px is reserved for chrome atoms (radius, border weight, badge dot, shadow specs).
- **Cqw note** — the showcase mirrors every `vw` value as `cqw` against each frame's container so frames render at true proportion at any display size. The numbers do not change.
- **Grid**: a soft 12-column logical grid spaced by `{spacing.gap-frame}` (2vw) is the default; the cover, oversized-claim, stat, and closer plates ignore it and centre on the focal element.

## Elevation & Depth

Argens has a **low depth ceiling**. At frame scale:

- Allowed: `{shadows.card-rest}` on one floated card per frame; `{shadows.modal}` on the single closer/modal plate.
- Banned: glows, coloured shadows, the landing-page radial gold glow, blur backdrops on the establishing frame. Video compresses gradients into banding; depth is carried by **edge** (the 1px `{colors.border}` hairline) and **inset** (the bg → bg2 → bg3 step), not by light.

## Shapes

Radius scale survives verbatim. CTA geometry rule: at frame scale, the giant pill (`{components.button-primary-giant}`) uses `{rounded.pill}` (20px → fully round at scale). The button atom remains `{rounded.button}` (7px) for catalogue frames where multiple controls coexist.

## Components

Frontmatter `components:` is the source of truth. Prose context follows.

- **`{components.logo-mark}` / `{components.logo-mark-giant}`** — two distinct gold forms: a thick diagonal slash running **NE → SW** (upper-right to lower-left, long axis at ~120° from horizontal) occupying the upper-center-left of the mark; and a separate gold circle (diameter ≈ 35.6% of mark width) anchored at the **lower-right corner** (centre at 81% across / 77% down). There is a large visual gap (~29% of mark width) between the slash's right edge and the circle — these are **not a connected pill**. The SVG bounding box is 51.75 × 54.75 (aspect ratio 0.9452:1, slightly taller than wide). Never render in a square container; always preserve `width: {width}` and `height: {height}` separately. The giant variant carries the cover treatment.
- **`{components.wordmark-mega}`** — Space Grotesk 700 at `{typography.hero.wordmark-mega}` (30vw). The brand's signature monumental gesture. One per sequence, maximum.
- **`{components.button-primary-giant}`** — the closer's accent pill. Gold fill, dark text, fully round at scale. Construction not in tokens: cursor pointer behaviour is irrelevant; what matters is that the pill is **the only saturated gold** when it appears.
- **`{components.balance-chip-giant}`** — the focal-artifact plate's hero. Bg3 inset, hairline border, mono uppercase label above an `{components.amount-string}` numeral. Construction: a 1px `{colors.border}` divider sits between label and amount on the giant variant only (web variant skips this).
- **`{components.amount-string}`** — always two decimals, currency suffix in mono ("USDC", "USD"), never the bare number. When the value is loading: em-dash `—` in `{colors.muted}`. Never expose API 7-decimal raw values.
- **`{components.status-badge-frame}`** — the constellation atom for the catalog plate. Dot + uppercase mono label, tinted background. Four variants only.
- **`{components.ledger-row}`** — the dense exception. Horizontal hairline-divided rows: mono label (left) + status badge + amount string (right). No surface, no shadow — the row sits directly on `{colors.bg}`.
- **`{components.sidebar}` / `{components.topbar}` / `{components.nav-item-active}`** — web chrome atoms. They appear **once** as the establishing frame; they are not a recurring frame motif.
- **`{components.divider-labeled}`** — the "rule — label — rule" floating-label pattern from the auth pages. The brand's quietest typographic gesture; carries the colophon and closer.
- **`{components.index-numeral}`** — gold mono section index ("01 ·", "02 ·"). Lifted from the brand's mono-label voice; the gold here is `{colors.accent}` at full saturation but reads as chrome because of size.

## Motion & Timing

Argens's character is **direct, technical, minimal**. The cut grammar follows.

- **May animate**: `fadeInUp` (opacity 0→1 + translateY 6px→0, 0.2s ease-out) on copy reveal. A single hairline rule may sweep horizontally to introduce the ledger plate. The status-badge dot may pulse on the catalog plate at `dotPulse` (0.85→1, 0.25→1).
- **Must not animate**: the wordmark (it appears, it does not assemble); the gold accent (it does not glow, breathe, or shimmer); grounds (no parallax, no gradient drift); numerals (they cut; they do not tick up — a counter is a deck reflex).
- **Dwell** — minimum 2.4s per sparse frame, 3.6s for the cover and stat plates, 5.0s for the dense ledger plate. Pace is set by **element count**, not by duration: a 2-element frame cuts faster than a 4-element ledger row, but neither is sped up artificially.
- **Cut** — hard cuts only. No cross-dissolves, no whip-pans, no zoom-ins on text. Between the cover and the first claim, a 6-frame black hold (≈100ms) is permitted as a reset.
- **Export** — 1920×1080 H.264, 24 or 30 fps; 9:16 master for vertical; safe area respected at every aspect.

## Frame Treatments

### 1 · Identity Cover  (identity / cover · move: monumental wordmark, mark anchored)
**Ground** `{colors.bg}`, padding `{spacing.frame-pad}`.
**Container** flex column, centred both axes, gap `{spacing.gap-stack}`.
**Composes** `{components.logo-mark-giant}`, `{components.wordmark-mega}`, `{components.divider-labeled}`
**Focal** `{components.wordmark-mega}` ("argens", lowercase, all-caps banned): `{typography.hero.wordmark-mega}` (30vw), centred, baseline aligned with the giant mark.
**Chrome** `{components.logo-mark-giant}` (9vw wide × 9.52vw tall — preserve ratio) seated above-left of the wordmark cap-height; the mark's slash runs NE→SW across the mark body, with the circle sitting at the mark's lower-right corner; a `{components.divider-labeled}` at the bottom edge reads `— agent-custodial since 2026 —` in `{typography.hero.mono-frame}`.
**Accent** the mark's two gold forms (slash NE→SW + circle lower-right) — together that is the frame's single voltage.
**Silence** ~65% empty; the wordmark fills horizontally but leaves the top and bottom thirds open.
**Fixed** mark is never recoloured; wordmark is always lowercase; gold appears only in the mark.  **Free** the colophon string.
**Pace** low.

### 2 · Oversized Claim  (editorial / oversized-claim · move: fit-to-measure headline, gold rule kicker)
**Ground** `{colors.bg}`, padding `{spacing.frame-pad}`.
**Container** flex column, centred, gap `{spacing.gap-frame}`; text block capped at 78vw.
**Composes** `{components.index-numeral}`, `{components.divider-labeled}`
**Focal** the claim line in `{typography.hero.display-hero}` (14vw) when ≤3 words, stepping to `{typography.hero.claim-large}` (9vw) at 4–6 words, `{typography.hero.section-head}` (4.2vw) at 7+.
**Chrome** `{components.index-numeral}` ("01 ·") sits above the claim, left-aligned to the text block. A short caption in `{typography.hero.body-frame}` may sit beneath, ≤ 38vw wide, centred.
**Accent** the gold of the `{components.index-numeral}` is the single voltage.
**Silence** ~70% empty.
**Fixed** centred anchor; mono index always present.  **Free** claim copy, index number, caption.
**Pace** moderate.

### 3 · Focal Artifact — Balance  (focal-artifact · move: one inset surface, one numeral, centred)
**Ground** `{colors.bg}`, padding `{spacing.frame-pad}`.
**Container** flex column, centred; gap `{spacing.gap-stack}`.
**Composes** `{components.balance-chip-giant}`, `{components.mono-label}`, `{components.status-badge-frame}` (success)
**Focal** `{components.balance-chip-giant}` (≈48vw wide × 22vw tall) centred; the amount inside renders as `{components.amount-string}` at `{typography.hero.stat-numeral}`.
**Chrome** a `{components.mono-label}` ("TREASURY · USDC") above the chip; a single `{components.status-badge-frame}` (success, "AGENT ACTIVE") below the chip's right edge.
**Accent** the gold may appear as a 1px `{colors.accent}` rule running across the chip's interior divider — at full strength, once.
**Silence** ~60% empty.
**Fixed** amount-string format ("$10.50 USDC", 2dp, currency suffix); em-dash for loading.  **Free** the figure (from the script), label, status copy.
**Pace** moderate.

### 4 · Ledger  (data / ledger · move: hairline-divided rows, mono labels, amount-right)
**Ground** `{colors.bg}`, padding `{spacing.frame-pad-tight}`.
**Container** flex column, 6 `{components.ledger-row}` stacked, gap 0 (hairlines do the work).
**Composes** `{components.ledger-row}`, `{components.mono-label}`, `{components.status-badge-frame}`, `{components.amount-string}` (ledger variant), `{components.index-numeral}`
**Focal** the column itself; no single row dominates — the **table is the focal**. A `{typography.hero.section-head}` header ("TRANSACTIONS · 24H") sits above the table with `margin-bottom: 1.6vw` so a wrapped header can't collide with row 1.
**Chrome** each row: mono timestamp (left), `{components.status-badge-frame}`, amount-string at `{typography.hero.stat-ledger}` (right). `{components.index-numeral}` ("04 · LEDGER") at the top-right.
**Accent** one row carries the active gold left-rule (`border-left: 2px solid {colors.accent}`, mirroring `{components.nav-item-active}`); all other rows are unmarked.
**Silence** tight by design — the **named density exception**.
**Fixed** hairline divider weight (1px), amount-right alignment, mono timestamp.  **Free** timestamps, statuses, amounts (from the script).
**Pace** low.

### 5 · Chrome Establishing  (chrome / catalog · move: the product itself, framed once)
**Ground** `{colors.bg}`, padding 0 (this frame is the product shell, full-bleed).
**Container** flex row; `{components.sidebar}` (11.46vw wide, full height) + main column.
**Composes** `{components.sidebar}`, `{components.topbar}`, `{components.nav-item-active}`, `{components.nav-item-inactive}`, `{components.balance-chip}`, `{components.wordmark}`, `{components.card-surface}`
**Focal** the sidebar's `{components.nav-item-active}` row — the active gold left-rule — and the `{components.balance-chip}` in the header. Together they read as "this is the app."
**Chrome** topbar with title + subtitle in reading-ramp sizes; main column carries a single `{components.card-surface}` (≈55vw wide) holding a quiet headline + body text.
**Accent** the active nav rule. Single voltage.
**Silence** ~45% empty (main card sits in space).
**Fixed** sidebar geometry, active-item rule colour, balance-chip construction.  **Free** title, subtitle, active nav label.
**Pace** moderate.

### 6 · Stat Numeral  (focal-artifact / brand-signature · move: one number, one caption)
**Ground** `{colors.bg}`, padding `{spacing.frame-pad}`.
**Container** flex column, centred.
**Composes** `{components.amount-string}` (numeral-only), `{components.mono-label}`, `{components.divider-labeled}`
**Focal** a single numeral in `{typography.hero.stat-numeral}` (11vw), centred. The numeral is the script's figure rendered as a string ("$2,481,930.00", "99.97%", "0 ms").
**Chrome** `{components.mono-label}` ("ASSETS UNDER AGENT MANAGEMENT · LIVE") above the numeral; `{components.divider-labeled}` below reading "— ledger.argens.fi —" or similar colophon.
**Accent** the numeral itself sits in `{colors.text}` with the unit suffix in `{colors.accent}` — the suffix is the gold (one voltage, scarce).
**Silence** ~72% empty.
**Fixed** amount-string format; suffix in gold; numeral never animates.  **Free** the figure (from the script).
**Pace** low.

### 7 · Closer  (closer / CTA · move: giant pill on dark, divider-labeled colophon)
**Ground** `{colors.bg}`, padding `{spacing.frame-pad}`.
**Container** flex column, centred, gap `{spacing.gap-frame}`.
**Composes** `{components.section-head}`, `{components.button-primary-giant}`, `{components.divider-labeled}`, `{components.logo-mark}`
**Focal** `{components.button-primary-giant}` carrying the action verb in `{typography.hero.pill-giant}` ("Get the keys", "Read the docs ↗"). The pill is the frame's **only saturated gold**.
**Chrome** a quiet headline in `{typography.hero.section-head}` above the pill; below, a `{components.divider-labeled}` reading "— argens.fi —" with the small `{components.logo-mark}` baseline-aligned to the label.
**Accent** the gold pill, full strength, once.
**Silence** ~68% empty.
**Fixed** pill is the only gold; external-link arrow ↗ when external; lowercase brand string.  **Free** verb, headline, link suffix.
**Pace** moderate.

## Do's and Don'ts

**Do**
- Lean centred. The cover, claim, balance, stat, and closer plates centre their focal element. Use left-anchor for the ledger and chrome plates only.
- Vary the anchor — no more than **2 consecutive frames** share an anchor.
- Cap headlines at **≤ 78vw wide** and step the hero ramp by word count.
- Ration gold to **one full-strength placement per frame**.
- Write amounts as strings with currency suffix; em-dash `—` for loading.
- Bleed one focal element near the edge cropping on every 3–4 frames as a cadence break.

**Don't**
- Don't put a top-left mono kicker on every frame — that is the deck tell. Ration it.
- Don't run the same composition axis twice in a row.
- Don't fill a sparse frame to look complete. The 55–75% empty is the brand.
- Don't apply filters, opacity, or hue shifts to the mark.
- Don't use coloured or glowing shadows. No radial gold glow at frame scale.
- Don't animate numerals (no count-up tickers); don't shimmer the gold.
- Don't put a second saturated gold element in the same frame.
- Don't expose 7-decimal raw amounts or untranslated API error codes.
- Don't recur web chrome (sidebar / topbar) across multiple frames — the establishing frame is its one appearance.

## Aspect-Ratio Behavior

| Treatment | 16:9 (1920×1080) | 9:16 (1080×1920) | 1:1 (1080×1080) |
|---|---|---|---|
| 1 · Identity Cover | Wordmark `{typography.hero.wordmark-mega}` 30vw, mark above-left. | Mark stacks above wordmark; wordmark steps to 20vw to clear safe area; colophon stays at bottom. | Wordmark 22vw, mark above; colophon under. |
| 2 · Oversized Claim | Centred, ramp stepped by word count. | Text block re-caps at 86vw of the narrow edge; ramp steps one size down. | Same as 16:9 with 78vw cap; index above. |
| 3 · Focal Artifact — Balance | Chip 48vw × 22vw, centred. | Chip widens to 78vw, taller (28vw); status badge re-flows under the chip. | Chip 64vw × 26vw; status badge stays under the right edge. |
| 4 · Ledger | 6 rows visible; header above. | 4 rows visible; rows widen; index numeral re-anchors to top-left. | 4 rows; header padding tightens to `{spacing.frame-pad-tight}`. |
| 5 · Chrome Establishing | Sidebar 11.46vw + main; full-bleed. | Sidebar collapses to a `{components.wordmark}` + balance row at the top; main occupies the rest. | Sidebar 18vw; main column tighter. |
| 6 · Stat Numeral | Numeral 11vw, centred. | Numeral steps to 16vw of the narrow edge; suffix wraps under. | Numeral 13vw, centred. |
| 7 · Closer | Giant pill, centred. | Pill stretches to 70vw of the narrow edge; headline above stacks. | Pill 56vw wide; colophon under. |

Safe area is enforced on the short edge in every ratio; no load-bearing line drops below the 1.4vw floor.

## Approved Real Entities & Numerals

Real strings the brand owns (lift verbatim only when the script names them):

- **argens** (lowercase in prose; Title-case only in document titles).
- **agent-custodial** (never "non-custodial").
- **USDC**, **USD** (currency suffix on amount strings).
- Status labels: `SUCCESS`, `CONFIRMED`, `APPROVED`, `BLOCKED`, `REJECTED`, `FAILED`, `PENDING`.
- Loading state: `—` (em-dash) for figures; `Loading…` (ellipsis) for text.
- External-link suffix: `↗`.

**Never invent figures.** Treasury balances, transaction counts, latency numbers — all come from the script. Placeholder in the showcase: `— figure —`, `{amount}`, `{tx-count}`.

## Pre-Render Self-Audit

Run before finalizing any frame:

- [ ] **Squint** — exactly one element dominates at 3–6× its nearest neighbour.
- [ ] **Silence** — sparse plate reads 55–75% empty (ledger exempt and declared).
- [ ] **Restraint** — exactly one full-strength `{colors.accent}` placement; echoes use `accent-low` / `accent-mid`.
- [ ] **Weight** — Space Grotesk heads carry negative tracking; mono labels carry +0.06em uppercase.
- [ ] **Depth** — at most one `{shadows.card-rest}` lift; no glows; no radial gradient.
- [ ] **Geometry** — radii match `{rounded}` tokens; giant pill uses `{rounded.pill}`.
- [ ] **Anchor** — centred unless the plate is ledger or chrome; consecutive frames vary the anchor.
- [ ] **Element count** — ≤ 2–3 distinct elements (focal + kicker + optional support). If two ideas, split into two frames.
- [ ] **Floor** — every load-bearing line ≥ 1.4vw.
- [ ] **Fidelity** — every size references a frontmatter token; nothing invented in treatment prose.
- [ ] **Strings** — amounts as `"$N.NN USDC"`; lowercase `argens`; `agent-custodial`; em-dash for loading; ↗ on external links.

## Known Gaps

- **Vw-as-string** — the DESIGN.md spec stores unknown unit values as strings; `30vw` etc. are stored verbatim by spec-conformant consumers. Documented.
- **Hero ramp is derived** — the source `design.md` reading ramp tops out at 64px; the hero ramp (`wordmark-mega`, `display-hero`, etc.) is added for frame scale and has no source equivalent. Atoms (weight, tracking, family) come from the source verbatim; only the sizes are new.
- **Frame-scale variants are derived** — `button-primary-giant`, `balance-chip-giant`, `status-badge-frame`, `logo-mark-giant`, `ledger-row` are added to compose at frame scale. Construction (colors, borders, radii) is the source's; only padding and typography step up.
- **Aspect re-scales are guidance, not pixel-perfect specs** — 9:16 and 1:1 reflows reproduce the structural move; specific cqw figures may need a 5–10% adjustment at render time.
- **Web chrome appears once** — the Chrome Establishing plate uses sidebar/topbar verbatim from `design.md`; these atoms are not intended for repeated frame use.
