---
name: OUM (OpenWrt Ultimate Manager)
description: A calm domestic dispatch board for understanding and safely controlling a home network.
colors:
  canvas: "#eef0ea"
  paper: "#fbfcf8"
  paper-strong: "#ffffff"
  ink: "#17231f"
  subtle: "#627068"
  faint: "#849087"
  line: "#cfd6ce"
  line-strong: "#aeb9b0"
  console: "#172c28"
  console-soft: "#213b35"
  action: "#2868d7"
  action-dark: "#174b9f"
  action-soft: "#e8effd"
  good: "#1f8a62"
  good-soft: "#e5f4ed"
  warn: "#a96617"
  warn-soft: "#fff0d9"
  bad: "#b83f39"
  bad-soft: "#fbe8e6"
  signal: "#d7f06b"
typography:
  display:
    fontFamily: "Segoe UI Variable, Noto Sans, Ubuntu Sans, system-ui, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3.35rem)"
    fontWeight: 760
    lineHeight: 0.95
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Segoe UI Variable, Noto Sans, Ubuntu Sans, system-ui, sans-serif"
    fontSize: "1.35rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.018em"
  title:
    fontFamily: "Segoe UI Variable, Noto Sans, Ubuntu Sans, system-ui, sans-serif"
    fontSize: "1.22rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.018em"
  body:
    fontFamily: "Segoe UI Variable, Noto Sans, Ubuntu Sans, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Segoe UI Variable, Noto Sans, Ubuntu Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "0.075em"
rounded:
  segmented: "8px"
  control: "9px"
  inset: "11px"
  notice: "12px"
  surface: "16px"
  console: "20px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.paper-strong}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
    height: "38px"
  button-primary-hover:
    backgroundColor: "{colors.action-dark}"
    textColor: "{colors.paper-strong}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
    height: "38px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
    height: "38px"
  input:
    backgroundColor: "{colors.paper-strong}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "9px 11px"
    height: "42px"
  panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "22px 24px"
  status-console:
    backgroundColor: "{colors.console}"
    textColor: "{colors.paper-strong}"
    rounded: "{rounded.console}"
    padding: "24px 22px 20px"
---

# Design System: OUM

## Overview

**Creative North Star: "Домашний диспетчерский щит"**

OUM is a calm, precise control surface for domestic infrastructure. It makes the network read as one labeled engineering circuit rather than a collection of unrelated admin cards: a deep green instrument summarizes health, while paper-light work surfaces hold safe controls and progressively disclosed expert detail.

The mode is **Operate**. Normal operation stays quiet; action blue and state colors appear only where they carry meaning. The interface remains recognizably OUM across the dashboard, settings, and first-run recovery route without imitating LuCI's default administrative table language.

**Direction Contract — verified seed `304ab282`:**

- **THESIS:** OUM делает невидимую домашнюю сеть обозримой как один подписанный и безопасно управляемый инженерный контур.
- **OWN-WORLD:** Тёплый домашний диспетчерский щит: глубокая зелёная консоль, бумажно-светлые рабочие поверхности, тонкие разделительные линии, небольшие сигнальные лампы и подписи, которые объясняют назначение каждого канала.
- **STORY:** Пользователь сначала считывает здоровье всей сети, затем видит подключённые устройства, после этого управляет текущим VPN-движком и только при необходимости раскрывает маршрутизацию, диагностику и экспертные инструменты.
- **FIRST VIEWPORT:** Крупное имя OUM и короткое обещание переходят в единую четырёхканальную консоль: интернет, клиенты, температура и VPN. Ниже уже виден вход в список устройств. Первый экран должен запоминаться как цельный пульт, а не как сетка карточек.
- **FORM:** Один тёмный статусный прибор и крупные светлые рабочие секции. Внутри секций структура создаётся линиями, ритмом и тональными полями; вложенные карточки не используются. Действия синие, готовность зелёная, ожидание янтарное, ошибка красная. На телефоне те же каналы складываются в вертикальную линию без потери порядка.

**Key Characteristics:**

- One dark, unified status instrument above large light work surfaces.
- Warm green-gray neutrals, ruled channels, and sparse signal-lamp accents.
- Human Russian copy first; technical values remain precise and scannable.
- Expert controls are present but visually secondary and progressively disclosed.
- Responsive order, keyboard focus, text-backed states, and reduced motion are system invariants.

## Colors

The palette combines domestic paper and green-black hardware with a single blue action channel and explicit, text-backed operational states.

### Primary

- **Control Blue:** Reserved for primary actions, selected choices, active tabs, and disclosure markers.
- **Deep Control Blue:** Strengthens hover states without changing the semantic channel.
- **Washed Control Blue:** Marks selected rows and choices without turning them into floating cards.

### Secondary

- **Console Green:** The dark shared instrument for the network-health summary.
- **Soft Console Green:** A supporting dark tone when the console needs tonal separation.
- **Signal Lime:** A tiny indicator, selection highlight, or signal lamp; never a broad surface fill.

### Tertiary

- **Ready Green / Waiting Amber / Recovery Red:** Encode ready, in-progress or attention, and error states respectively; every use is accompanied by text.
- **Soft State Fields:** The pale green, amber, and red companions provide quiet state backgrounds for notices and jobs.

### Neutral

- **Domestic Canvas:** The warm page field behind every OUM surface.
- **Working Paper / Strong Paper:** Main work surfaces and crisp form-control interiors.
- **Green Graphite:** Primary text, chosen for softer contrast than neutral black.
- **Muted Ink / Faint Ink:** Secondary guidance and low-priority metadata.
- **Ruled Line / Strong Ruled Line:** Section structure and control boundaries.

### Named Rules

**The Signal Is Sparse Rule.** Signal lime is a lamp, cursor, or selection highlight—not a panel background.

**The State Has Words Rule.** Green, amber, and red may reinforce a state but never carry its meaning alone.

## Typography

**Display Font:** Segoe UI Variable with Noto Sans, Ubuntu Sans, and system sans-serif fallbacks

**Body Font:** The same local Cyrillic-capable sans-serif stack
**Technical Font:** The system monospace stack, only for configuration payloads and dense technical values

**Character:** Compact, confident headings make the product feel like a purpose-built appliance rather than a generic admin theme. Body copy stays human and highly legible; measurements, addresses, and counters use tabular numerals for stable scanning.

### Hierarchy

- **Display:** Dense OUM and first-run titles with a tight line and slight negative tracking.
- **Headline:** Step and major instrument headings, compact enough to preserve task density.
- **Title:** Section headings that introduce one work surface or circuit.
- **Body:** The default operating text; explanatory passages stay near a readable maximum of 72 characters.
- **Label:** Uppercase instrument labels and table headers with generous tracking.

### Named Rules

**The Appliance Voice Rule.** Use the local sans stack for the interface; reserve monospace for content that is genuinely code-like or machine-shaped.

## Layout

The main dashboard and settings surface are centered within a maximum width of 1180px, with a recurring 8/12/16/24/32px rhythm. Page identity flows into one four-channel status console, then into large work sections. Lines, spacing, and low-contrast tonal fields organize detail inside those sections; they do not spawn nested card grids.

At 900px the four-channel console becomes 2×2 and multi-column settings groups collapse. At 700px it becomes a single ordered channel, device tables become labeled vertical records, route controls stack, and persistent action rows become full-width. First-run uses a focused 900px setup desk and shifts its two-column fields to one column at 650px. Long SSIDs, node names, addresses, and status messages wrap within the page.

**The Circuit Order Rule.** Responsive reflow may change columns, but it never changes the operational story: health, devices, protected connection, then advanced control.

## Elevation & Depth

The system is flat by default and uses a restrained hybrid of tonal layering, ruled boundaries, and only four ambient shadows. The strongest depth belongs to the focused first-run desk; ordinary panels receive a nearly imperceptible lift, while the dark summary console reads as a single physical instrument.

### Shadow Vocabulary

- **Console Ambient:** `0 18px 45px rgba(31, 49, 42, .08)` gives the shared status instrument quiet presence.
- **Work Surface:** `0 10px 28px rgba(31, 49, 42, .045)` separates large paper sections from the canvas.
- **Pinned Action:** `0 10px 24px rgba(30, 48, 41, .12)` supports the translucent save strip without making it float theatrically.
- **Setup Desk:** `0 24px 70px rgba(31, 49, 42, .1)` isolates the first-run recovery task.

### Named Rules

**The One Instrument Rule.** The status console may lift as a whole; its channels never become independently shadowed cards.

## Shapes

Corners describe hierarchy. Inputs and buttons use compact 9px corners, inset choices and status fields use 11px, notices and pinned controls use 12px, work surfaces use 16px, and the status console and first-run desk use 20px. Channel dividers, tabs, progress tracks, and internal routing boxes remain square or line-based so the appliance metaphor stays precise.

**The Outer Curves, Inner Lines Rule.** Round the containing instrument; structure its contents with straight rules and tonal fields.

## Components

### Buttons

- **Shape:** Compact controls with gently curved corners and a minimum height of 38px; touch-critical controls reach at least 42px.
- **Primary:** Solid Control Blue with white text and clear verb-led Russian labels.
- **Secondary:** Transparent on paper with a strong ruled outline; hover introduces the soft blue field.
- **Hover / Focus:** State changes take 160ms; keyboard focus uses a visible 3px blue ring with 3px offset. Disabled controls stay legible, lose emphasis, and never animate.

### Status Console

- **Style:** One deep-green 20px-radius instrument divided into four equal ruled channels: internet, clients, temperature, and VPN.
- **Signal:** One small lime lamp identifies the live instrument; state meaning remains textual inside each channel.
- **Responsive:** Four columns become 2×2 at tablet width and a single ordered stack on phones.

### Cards / Containers

- **Corner Style:** Large work sections use the surface radius; nested information uses lines or low-contrast fields instead of more cards.
- **Background:** Working Paper on the Domestic Canvas; Strong Paper is reserved for form controls and a few enclosed rows.
- **Border:** One Ruled Line boundary; use the stronger line only for controls and major separators.
- **Internal Padding:** Typically 22–24px on desktop and 16–18px on phones.

### Inputs / Fields

- **Style:** Strong Paper interior, strong ruled border, compact corner, full available width, and at least 42px height.
- **Focus:** The global blue focus-visible ring remains outside the control and is never suppressed.
- **Error / Disabled:** Errors use recovery text plus red; disabled controls retain their label and drop to 46% opacity.

### Choice Rows and Segmented Routing

- **Style:** Choice rows are transparent in a work surface and use an inset blue line plus washed-blue field when selected. Binary route switches share one 8px outline and fill only the selected half.
- **Behavior:** Native radios remain present and accessible even when their visual weight is reduced.

### Navigation and Disclosure

- **Style:** OUM has two permanent destinations—dashboard and settings. First-run is a separate recovery route and is not duplicated in navigation.
- **Tabs:** Text sits on a baseline rule; active state is a blue underline, not a pill.
- **Disclosure:** Expandable expert sections share the same plus/minus marker and at least a 42px hit area.

### Setup Progress

- **Style:** A thin ruled track with Control Blue completed segments and a compact terminal dot; it reads as progress through one setup circuit, not a row of pills.

## Do's and Don'ts

### Do:

- **Do** lead with network health and place the next safe action beside the relevant state.
- **Do** preserve one source of truth for each setting and keep dangerous or expert operations visually secondary.
- **Do** accompany every operational color with explicit Russian state text.
- **Do** preserve keyboard focus, 42px touch targets where interaction demands them, reduced-motion behavior, and mobile wrapping.
- **Do** use local system assets only; the router interface must remain light and independent of remote fonts, images, or libraries.

### Don't:

- **Don't** turn the dashboard into a grid of unrelated floating metric cards.
- **Don't** nest cards inside work surfaces when a rule, rhythm, or tonal field can express the hierarchy.
- **Don't** use Signal Lime as decoration or a large fill.
- **Don't** require hover, color vision, LuCI knowledge, or technical jargon to understand a primary task.
- **Don't** visually imply changes to RPC, UCI, routing, rollback, permissions, or any other networking behavior.
