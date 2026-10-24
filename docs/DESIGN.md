# Chalk — Design System

Visual reference: **craft.do** (values measured from its live CSS on 2026-10-20; craft.do is built on Tailwind + shadcn/ui, same as Chalk, so values map 1:1).
We copy the *feel and mechanics* — NOT Craft's brand: no Craft logo, no torn-paper collage illustrations, no Craft copy, no Untitled fonts (commercial, Klim Type Foundry).

## ⭐ 0. Craft principles — MUST follow on every screen
1. **Surfaces, not coloured boxes.** Content sits on white cards (or the glass from §1) over the beige paper. Separation comes from soft shadows, 1px hairlines (`--border`) and whitespace — never from coloured backgrounds with thick coloured borders.
2. **❌ Forbidden:** tinted section/card background + thick (≥2px) darker border of the same hue. No coloured left/top border stripes either.
3. **Colour is sparse and small:** a 8px student dot, a status pill, a small chip, a number. Large areas stay white / beige / glass. At most one soft tint on a screen, and only for a small callout.
4. **Emphasis by elevation and type, not colour:** the important card (e.g. the current lesson) is the white card with the larger shadow (glass shadow §6) and bigger serif text; a small pulsing dot + pill says "Vyksta dabar".
5. Ink-black pill buttons for primary actions, white pill buttons for secondary — as in Craft.
6. When unsure, ask: "would craft.do do this?" — calm, airy, editorial, mostly monochrome.

---

## ⭐ 1. THE TOP NAVBAR — the signature element (highest priority)

> **This is the single most important UI element of Chalk. It must be reproduced faithfully: a floating, centred, pill-shaped glass bar that morphs open into a large rounded glass panel with menu tiles. There is NO sidebar — this bar is the app's primary navigation on every page.**

### 1.1 Closed state
- `position: fixed`, `top: 32px` (16px on mobile), horizontally centred, `z-50`.
- Width: `calc(100% - 96px)`, `max-width: 920px` (mobile: `calc(100% - 32px)`).
- Height **52px**; inner padding `8px 8px 8px 16px`; content is a single row `justify-between`.
- Shape: **full pill** (`border-radius: 64px`).
- Glass:
  - `background: linear-gradient(180deg, #fff6 10%, #fffc);` (white 40% → 80%)
  - `backdrop-filter: blur(4px)` closed → `blur(12px)` open (transition 100ms).
  - **Gradient hairline border** via `::before` + mask:
    ```css
    .glass-border::before{
      content:""; position:absolute; inset:0; padding:1px; border-radius:inherit; pointer-events:none;
      background:linear-gradient(rgba(255,255,255,.64) 40%, rgba(255,255,255,0) 75%, rgba(255,255,255,0) 95%, rgba(255,255,255,.64));
      -webkit-mask:linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite:xor; mask-composite:exclude;
      transition:.5s ease-in-out;
    }
    ```
  - Shadow: `0 12px 12px 2px #0000001a, 0 2px 4px -1px #0000000f`.
- Layout (left → centre → right):
  - **Left:** "Chalk" wordmark (our own: Source Serif 4, 22px, weight 500, letter-spacing −0.02em; optional tiny chalk-stroke mark). Never the Craft logo.
  - **Centre:** nav items, `gap: 20px`, Inter 16px/22.4px, weight 400, letter-spacing −0.32px, colour ink. Items: **Šiandien · Mokiniai ▾ · Tvarkaraštis · Finansai ▾ · Įrankiai ▾**. Active page = ink + small 4px dot under it (or weight 500).
  - **Right:** sync-status dot (Sage = synced, Sand = syncing, Coral = error; tooltip) + secondary text link "Nustatymai" + **primary black pill button "+ Pamoka"** (bg `#030302`, white text, Inter 500 16px, padding `8px 14px`, height 36, `rounded-full`, shadow `0 1px 3px #0000001a, 0 1px 2px -1px #0000001a`).

### 1.2 Open state (dropdown = the bar itself grows)
- Clicking (or hovering ~120ms on desktop) an item with ▾ **morphs the same bar** — it does not open a separate floating menu:
  - height animates **52px → content height** (≈ 240–300px),
  - border-radius animates **64px → 26px**,
  - blur 4px → 12px.
- The top row stays in place. **All other nav items dim** to `rgba(3,3,2,.35)` (colour transition 200ms); the active one stays ink.
- Panel body (below the top row): padding `8px`, grid with `gap: 8px`:
  - **Left area (≈ 2/3 width): large tiles** in a 2×2 grid. Each tile: `border-radius: 14px`, `padding: 12px`, background `rgba(255,255,255,.5)`, height ≈ 98px. Content: 20px line icon + **title** (Inter 500, 16px/22.4px, ink) on one row; **description** below (Inter 400, 14px/16.8px, `rgba(3,3,2,.5)`).
  - **Right column (≈ 1/3 width): compact tiles** stacked, height ≈ 46px each, same radius/background, icon + label (Inter 500 16px).
  - Tile hover: `transform: scale(1.05)`, `transition: 200ms cubic-bezier(.4,0,.2,1)`. (Mobile: `translateX(8px)` instead.)
- Panel content fades in (opacity 0 → 1) while the bar grows; fades out before it shrinks.
- Close on: click outside, `Esc`, choosing an item, hovering a different top item (switches content without fully closing — the height re-animates to the new content).
- Motion: exact Craft timing couldn't be measured; use **Motion (framer-motion) layout animation with a spring** `{ type: "spring", stiffness: 400, damping: 35 }` (≈300ms, no bounce), or CSS `300ms cubic-bezier(.215,.61,.355,1)`. Respect `prefers-reduced-motion` (instant).
- Accessibility: items are buttons with `aria-expanded`, panel `role="menu"`, full keyboard nav (Tab/Arrow/Enter/Esc), focus ring `ring-2 ring-white` on the pill.

### 1.3 Chalk menu content
| Top item | Large tiles (icon · title · description) | Compact right column |
|---|---|---|
| **Mokiniai ▾** | Visi mokiniai · "Visas sąrašas ir balansai" / Pastovūs · "Savaitinės pamokos" / Nepastovūs · "Pamokos pagal poreikį" / Derinama · "Laukia sutarimo" | + Naujas mokinys · Pauzė · Archyvas |
| **Finansai ▾** | Apžvalga · "Uždirbta, gauta, skolos" / Mokėjimai · "Banko įplaukos ir priskyrimas" / Skolos · "Kas ir kiek skolingas" / Mokesčiai · "IV: GPM, VSD, PSD" | Šis mėnuo · Ši savaitė · Eksportas |
| **Įrankiai ▾** | Eduka · "Vadovėliai ir medžiaga" / tldraw · "Nauja lenta" / ChatGPT · "Uždavinių sprendimas" / Claude · "Uždavinių kūrimas" | Google Calendar · Bankas · Nustatymai |

Counts/badges allowed on tiles (e.g. "Derinama 3", "Nepriskirti mokėjimai 2" as small Sand pills).

### 1.4 Mobile (< 768px)
- Bar: wordmark left, "+ Pamoka" icon button + hamburger right; height 52, pill.
- Hamburger morphs the bar into a full-width rounded panel (radius 26px) with the same tiles stacked in one column; same glass and animation.

---

## 2. Shape language — rounded everywhere
Nothing in Chalk has a sharp corner.
| Element | Radius |
|---|---|
| Buttons, chips, status pills, avatar, search field, segmented controls | `9999px` (full pill) |
| Inputs, selects, textareas | 12px |
| Menu tiles, list rows on hover, small cards | 14px |
| Cards (lesson, student, stat) | 20px |
| Modals, sheets, popovers, the open navbar | 26px |
| Big page containers / hero sections | 32px |
Base token `--radius: 0.625rem` (shadcn) — override per element as above.

## 3. Layout — centred
- Everything is centred on the screen horizontally. Navbar max 920px; page content column **max 1040px**, centred, side padding 24px (16px mobile).
- Page top padding clears the floating navbar (≈ 116px desktop, 84px mobile).
- Page header: centred serif title, optional centred one-line subtitle in muted sans, then content.
- Focus pages (Šiandien timeline, lesson notes form) use a narrower centred column **max 720px**.
- Tables/lists live inside a centred rounded card, not edge-to-edge.
- Modals centred, max 560px.

## 4. Typography
| Role | Font | Spec |
|---|---|---|
| Sans (UI, body) | **Inter** 400/500 (`next/font/google`) | body 16px / 22.4px, letter-spacing −0.32px |
| Serif (titles, big numbers) | **Source Serif 4** 400/500 + italic | |
- Page title: serif 400, 44px desktop / 32px mobile, line-height 1.05, letter-spacing −0.03em.
- Section title: serif 400, 28px, lh 1.1, −0.02em.
- Big stat / balance: serif 400, 36px, `tabular-nums`.
- Label / button: Inter 500, 14–16px. Meta: Inter 400, 13px, muted.
- One emphasised word in serif *italic* is a signature move (e.g. "Labas, *Adomai*").
- Dashes: always the en dash „–“ (with spaces in text, e.g. „Pradėti nuo – …“, ranges „08–22“); never the em dash „—“, also for empty values („–“).

## 5. Colour tokens
```css
:root{
  --background:#fcf9f7;          /* warm paper beige */
  --foreground:#030302;          /* ink */
  --card:#ffffff;
  --muted:#0303020a;             /* ink 4% */
  --border:#03030217;            /* ink 9% */
  --ring:#0303021f;              /* ink 12% */
  --muted-foreground:#6b6966;    /* 5.2:1 on paper — WCAG AA */
  --dimmed-foreground:#03030259; /* ink 35% – dimmed nav items only */
  --primary:#030302; --primary-foreground:#ffffff;
  --navbar-gradient:linear-gradient(180deg,#fff6 10%,#fffc);
  --glass-gradient:linear-gradient(180deg,#fff9,#ffffff96 25%,#fff9 50%,#ffffffd6 75%);
}
```

### Palette — 12 soft, Craft-like tones (not generic red/blue/green)
Inspired by Craft's illustration colours: powdery sky, sage, clay, sand. Each tone has **base** (dots, chart bars, calendar blocks), **tint** (small chips/pills background only) and **ink** (text on white or tint; all ≥ 5.8:1).
| Name | Base | Tint | Ink |
|---|---|---|---|
| Sky | `#8DB4D9` | `#EEF4FA` | `#2F5B80` |
| Sage | `#9DB89A` | `#F0F5EF` | `#3E5E3B` |
| Clay | `#D39A7A` | `#FAF0EA` | `#8A4A2B` |
| Lavender | `#A9A1D6` | `#F2F0FA` | `#4D4589` |
| Sand | `#D8C08A` | `#FAF5E8` | `#6E5720` |
| Rose | `#D69AA8` | `#FAEFF2` | `#8A3E52` |
| Mist | `#8CC2BE` | `#EDF6F5` | `#2E6662` |
| Apricot | `#E5AE7E` | `#FCF2E8` | `#8A501F` |
| Plum | `#B597B5` | `#F6F0F6` | `#6A3F6A` |
| Slate | `#9AA6B5` | `#F1F3F6` | `#3F4B5B` |
| Moss | `#B3B57A` | `#F6F6EA` | `#55571F` |
| Coral | `#E09A8C` | `#FBEFEC` | `#8F3F31` |
Tokens: `--sky`, `--sky-tint`, `--sky-ink`, … for all 12.

Semantic mapping:
- Skola / klaida → Coral ink · Sumokėta / avansas / Įvyko → Sage ink · Derinama / laukia → Sand · Nepastovus → Lavender · Pastovus → Sky · Pauzė → Slate · Archyvuotas → `--muted-foreground`.
- Each student gets one of the 12 tones (auto-assigned, unique while ≤ 12 active students, editable) — shown only as a small dot, the calendar block and the day-strip block.

Dark mode (our own, same spirit): background `#141312`, card `#1d1c1a`, foreground `#f5f2ee`, border `#ffffff17`, muted-foreground `#a8a49f`; navbar gradient `linear-gradient(180deg,#1d1c1a99 10%,#1d1c1ae6)`; palette: base unchanged, tint = base at 16% on card, ink = base lightened ~20%.

## 6. Surfaces & effects
- Cards: white, radius 20px, 1px `--border`, shadow `0 1px 3px #0000000d`; hover → glass shadow.
- Highlighted card (e.g. current lesson): still white, glass shadow + slightly larger padding/type; never tinted fill + thick coloured border (§0).
- Glass shadow: `0 12px 12px 2px #0000001a, 0 2px 4px -1px #0000000f`; hover `0 20px 25px 4px #0000001a, 0 10px 10px -5px #0000000a` (500ms ease-out).
- Big soft shadow (modals): `0 50px 40px #00000003, 0 50px 40px #00000005, 0 20px 40px #0000000d, 0 3px 10px #00000014`.
- Modals and popovers use the same glass as the navbar over a `rgba(3,3,2,.2)` backdrop with 4px blur.

## 7. Buttons
- Primary: black pill (see navbar). Large: white pill, padding `16px 32px`, h 48, glass shadow, hover lifts shadow (500ms `cubic-bezier(0,0,.2,1)`).
- Secondary: white pill with 1px border. Ghost: text only, colour transition 200ms.
- Destructive: red text ghost; destructive confirm = red pill.
- Focus: `ring-2` `--ring`, rounded-full.
- „Prisijungti“ (Meet) is always the primary black pill – every lesson, every screen.

## 8. Motion
- Default colours/borders: `150ms cubic-bezier(.4,0,.2,1)`. Buttons: `200ms` `transition-all`.
- Shadow lifts / large hovers: `500ms cubic-bezier(0,0,.2,1)`.
- Entering content: fade + translateY(8px), `300ms cubic-bezier(.215,.61,.355,1)`, stagger 40ms for lists.
- Navbar morph: spring (see §1.2).
- "Pamoka vyksta dabar": small Sage dot with `ping` keyframe (scale 2, fade).
- Skeletons: `pulse`. Accordions: Radix accordion-down/up.
- Always respect `prefers-reduced-motion`.

## 9. Long names & text overflow (applies everywhere)
Lithuanian names are long ("Konstantinas", "Aleksandravičiūtė"). Rules:
- **Text never wraps inside compact elements** (blocks, chips, pills, list rows, navbar tiles): `white-space:nowrap; overflow:hidden; text-overflow:ellipsis`, and `min-width:0` on flex/grid children.
- **The name shrinks, meta never does:** time, grade/level, amounts are `flex-shrink:0`, `tabular-nums`, never truncated or pushed to a hidden line.
- **Full text is always reachable:** truncated text has the full value in a tooltip (hover + keyboard focus) and on the detail screen.
- **Display name** = first name; if two active students share it, add the surname initial ("Ieva K.").
- **Fixed-size blocks adapt by width (container queries), not by wrapping:**
  - Day strip / week-view block: wide → name + time on two lines (each single-line, ellipsis); medium → name only (ellipsis); narrow → initials in a small circle. Hover/focus → glass popover with the display name (first name, never the surname), grade+level, time, buttons Prisijungti / Lenta. Only one popover open at a time: a clicked (pinned) popover blocks hover-opening others; a hover-opened one switches to the newly hovered block. Phone (< 768px): no horizontal scrolling anywhere – Tvarkaraštis fits all 7 days (blocks show initials in a tone circle, tap → popover, drag as on desktop; lesson cells square – height ≤ column width down to iPhone SE; fixed hours 08–24); Šiandien keeps the desktop structure (day strip → focus card → Toliau šiandien → Jau įvyko → stat cards); the day strip is compact: fits the width without scrolling, fixed 08–24, lessons as small tone squares (height ≤ width, initials only if they fit), tap → the same popover, „dabar“ line (decision 2026-10-24). Desktop unchanged.
  - Cards/rows: name ellipsis, time stays right-aligned.
- Large serif names (focus card, profile header) may wrap to 2 lines max, then ellipsis — never overflow the card.
- **Never clip descenders or diacritics** (g, j, p, q, y, ą, ę, į, ų, Š, Ž): truncated/clamped text uses line-height ≥ 1.2 (serif titles included) or vertical padding inside the clipping box; check with "Jogilė", "Gytis", "Jūratė", "Šarūnė".
- Placeholders must fit their field without truncation (keep them short).
- Every screen must be checked with stress data: "Konstantinas", "Aleksandra-Gabrielė", a 3-digit balance.
