# Design — 诗魂 · Poem Soul

A locked design system for this app. Every page reads this file before emitting
code. Do not regenerate per page — extend or amend this file when the system
needs to grow.

## Genre

**editorial** — a poetry-reading app. Quiet, generous, ink-on-paper. The voice
is a classical reading room, not a product page.

## Macrostructure family

- Marketing/landing page (home): **Manifesto-style hero** → daily poem → browse
  bookshelf. Varies only in hero composition between modes.
- App pages (search / author / browse): **document-led** — function carries the
  page, no decoration. Shared section-head rhythm (tag above, display heading
  directly underneath, same column).
- Content page (poem reader): **Long-document-style reading column** with
  couplet alignment. This is the heart of the app.

All pages share the system's type, colour, spacing, CTA voice. Within a mode
they share a skin; across modes the paper temperature + verse alignment differ
(see Theme).

## Theme — 墨宣 Ink & rice-paper (custom)

One token system, **two mode skins**. `:root` carries the classic (default)
values; `.page-modern` overrides the paper/ink/rule tokens to shift the skin.
Accent is the brand's 朱砂 vermillion seal throughout. Both skins share
spacing, easing, type, and CTA voice — they are skins of one system, not two
themes.

### Classic (default 古诗词) — warm 宣纸 ivory
- `--color-paper`   oklch(93% 0.020 80)
- `--color-paper-2` oklch(88.5% 0.022 77)
- `--color-paper-3` oklch(84% 0.025 74)
- `--color-ink`     oklch(31% 0.020 60)   warm charcoal
- `--color-ink-2`   oklch(46% 0.020 60)
- `--color-ink-3`   oklch(58% 0.020 58)
- `--color-rule`    oklch(79% 0.020 70)
- `--color-accent`  oklch(52% 0.150 30)   朱砂 seal red
- `--color-focus`   oklch(60% 0.150 30)

### Modern skin (现代诗) — cool editorial white
- `--color-paper`   oklch(98.5% 0.004 90)
- `--color-paper-2` oklch(96% 0.005 90)
- `--color-paper-3` oklch(93% 0.006 90)
- `--color-ink`     oklch(31% 0.008 270)  cool charcoal
- `--color-ink-2`   oklch(46% 0.008 268)
- `--color-ink-3`   oklch(58% 0.006 266)
- `--color-rule`    oklch(87% 0.006 88)
- `--color-accent`  oklch(54% 0.140 28)

## Typography

- Display/verse: "Noto Serif SC", "Songti SC", "SimSun", serif — weight 600,
  style normal (roman; italic headers banned). Classical verse gets generous
  `letter-spacing` and a large display for short 五/七言.
- Body (reading): same serif stack — CJK reading wants serif.
- UI/labels: "PingFang SC", "Microsoft YaHei", system-ui — for buttons, meta,
  nav.
- Mono: ui-monospace, Menlo, Consolas — numbers (counts, page indexes).
- Type-scale anchor: `--text-display` = clamp(2.4rem, 6vw, 4.5rem) for short
  classic verse; modern verse caps lower. All display is roman.

## Spacing

4-pt named scale in `tokens.css`. Pages use named tokens, never raw values.

## Motion

- Easings: `--ease-out` cubic-bezier(0.16, 1, 0.3, 1) etc.
- Reveal: fade + 6px lift on cards only; headings static.
- Reduced-motion: opacity-only crossfade ≤ 150 ms.

## Microinteractions stance

- Silent success. No celebratory toasts.
- Hover delay 800 ms · focus delay 0 ms.
- All interactive elements styled for all 8 states.

## CTA voice

- Primary CTA / active filter: vermillion fill, `--color-accent-paper` text,
  radius-sm.
- Secondary (shuffle / share): paper-2 fill, ink-2 text, hairline rule border,
  pill radius.
- All controls: rounded, `:focus-visible` 3:1 ring, never animate the ring.

## Per-page allowances

- Home MAY use enrichment (a single vermillion seal-block in hero — Tier-A
  CSS, no photography).
- App pages MUST NOT use enrichment. Search/author/browse function-led.
- Reading page: typography only.

## What pages MUST share

- The 詩 字标 seal mark; the 朱砂 accent at ≤ 5 % of viewport.
- Display + body serif, UI sans.
- The mode switch (central nav metaphor).
- Section-head rhythm (tag above heading, same column).
- Button shape / radius / padding rhythm.

## What pages MAY differ on

- Hero composition (classic manifesto vs modern quieter).
- Verse alignment (classical centred + couplets; modern left-aligned ragged).
- Paper temperature / ink temperature (the mode skins).

## Exports

Drop-in formats for re-using this system. The canonical tokens.css:

```css
:root {
  --color-paper:      oklch(93% 0.020 80);
  --color-paper-2:    oklch(88.5% 0.022 77);
  --color-ink:        oklch(31% 0.020 60);
  --color-ink-2:      oklch(46% 0.020 60);
  --color-ink-3:      oklch(58% 0.020 58);
  --color-rule:       oklch(79% 0.020 70);
  --color-accent:     oklch(52% 0.150 30);
  --color-accent-ink: oklch(97% 0.015 80);
  --color-focus:      oklch(60% 0.150 30);
  --font-display: "Noto Serif SC", "Songti SC", "SimSun", serif;
  --font-body:    "Noto Serif SC", "Songti SC", "SimSun", Georgia, serif;
  --font-ui:      "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  --font-mono:    ui-monospace, Menlo, Consolas, monospace;
  --space-3xs: 0.25rem; --space-2xs: 0.5rem; --space-xs: 0.75rem;
  --space-sm: 1rem; --space-md: 1.5rem; --space-lg: 2rem;
  --space-xl: 3rem; --space-2xl: 4.5rem; --space-3xl: 6rem;
  --text-xs: 0.75rem; --text-sm: 0.875rem; --text-md: 1rem;
  --text-lg: 1.125rem; --text-xl: 1.375rem; --text-2xl: 1.75rem;
  --text-3xl: 2.25rem;
  --text-display: clamp(2.4rem, 6vw, 4.5rem);
  --text-display-s: clamp(2rem, 5vw, 3.4rem);
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --dur-short: 180ms; --dur-base: 260ms; --dur-slow: 420ms;
  --radius-xs: 6px; --radius-sm: 10px; --radius-md: 14px; --radius-pill: 999px;
}
```
