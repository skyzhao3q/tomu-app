# Widget Renderer — Visual Creation Suite

Design guidelines returned by the `widgetReadme` tool. The AI must call `widgetReadme` once before its first `widgetRenderer` call. This is an internal setup step — never mention it to the user.

## Schema

```javascript
description: "Returns design guidelines for widgetRenderer (CSS patterns, colors, typography, layout rules, examples). Call once before your first widgetRenderer call. Do NOT mention this call to the user — it is an internal setup step."
parameters: {
  modules: "Which design guideline modules to load. Pick all that fit the use case: art, mockup, interactive, chart, diagram."
}
```

## Modules

Call `widgetReadme` again with the `modules` parameter to load detailed guidance:
- `diagram` — SVG flowcharts, structural diagrams, illustrative diagrams
- `mockup` — UI mockups, forms, cards, dashboards
- `interactive` — interactive explainers with controls
- `chart` — charts and data analysis (includes Chart.js)
- `art` — illustration and generative art

Pick the closest fit. The module includes all relevant design guidance.

## Complexity Budget — Hard Limits

- Box subtitles: <=5 words. Detail goes in click-through (`sendPrompt`) or the prose below — not the box.
- Colors: <=2 ramps per diagram. If colors encode meaning (states, tiers), add a 1-line legend. Otherwise use one neutral ramp.
- Horizontal tier: <=4 boxes at full width (~140px each). 5+ boxes → shrink to <=110px OR wrap to 2 rows OR split into overview + detail diagrams.

## Core Design System

These rules apply to ALL use cases.

### Philosophy

- **Seamless**: The widget must look and feel IDENTICAL to the host app — same colors, same typography, same spacing, same border-radius. Users shouldn't notice where the app ends and your widget begins. The widget background is transparent — it sits directly in the chat message flow with zero visual boundary.
- **Craftsmanship in every detail**: Treat every pixel as intentional.
  - **Color harmony**: never use raw/harsh colors. Always use the host CSS variables (`var(--primary)`, `var(--muted)`, `var(--border)`, etc.) or the color ramp stops from the palette. If you need a light tint, use `color-mix(in srgb, var(--primary) 10%, transparent)`.
  - **Consistent spacing**: use a 4px grid. Gaps: 4px (tight), 8px (compact), 12px (default), 16px (spacious), 24px (section breaks). Never odd values like 5px, 7px, 15px.
  - **Border treatment**: borders are always `1px solid var(--border)`. Never 2px+ unless it's a focus ring.
  - **Text hierarchy**: at most 3 levels — heading (`var(--foreground)`), body (`var(--foreground)`), secondary (`var(--muted-foreground)`).
  - **Rounded corners**: `var(--radius)` for elements, `calc(var(--radius) * 1.5)` for cards/containers.
  - **Whitespace**: generous padding inside containers (12-16px). Never let content touch edges.
  - **Visual weight balance**: redistribute if one side feels heavier. Centered for simple widgets, left-aligned for complex.
- **Layout must feel composed, not dumped**:
  - **Vertical rhythm**: consistent vertical spacing throughout. Section breaks get 24px.
  - **Alignment axes**: pick ONE alignment strategy and commit.
  - **Control bar layout**: `display: flex; gap: 8px; align-items: center`.
  - **Data grids**: CSS Grid with `grid-template-columns: repeat(auto-fit, minmax(120px, 1fr))`.
  - **Algorithm array/list layout**: `display: flex; justify-content: center; gap: 2px`.
  - **Tree layout**: center each level horizontally. Consistent vertical gap between levels (48-64px).
  - **Information density**: show the right amount. Never truncate or hide elements.
  - **Proportional sizing**: main display ~75%, controls ~25%.
  - **Responsive width**: percentage widths and `max-width`, not fixed pixels.
- **Two-layer animation philosophy**:
  - **Layer 1 — UI controls**: restrained and subtle. Button hover: background-color 0.15s. Card hover: border-color 0.2s. No scale transforms on controls.
  - **Layer 2 — visualization content**: rich, expressive, cinematic. Every state change animated with care.
    - Easing: `cubic-bezier(0.2, 0, 0, 1)` general. `cubic-bezier(0.175, 0.885, 0.32, 1.275)` spring for discovery/success.
    - Pointer movement: SLIDE with `transition: transform 0.4s`.
    - Current element highlight: `var(--primary)` bg + glow ring over 0.3s.
    - Eliminated regions: fade to `opacity: 0.35` over 0.3s.
    - Swaps: physically cross paths via `transition: transform 0.4s`. Never swap text instantly.
    - Edge/path traversal: SVG `stroke-dasharray` animation 0.4s per edge.
    - Found/success: spring-eased scale-up + glow intensification.
    - Step sequencing: choreographed ~0.5s per step with chained `setTimeout`.
    - Controls: "next step" + "reset". "auto-play/pause" + speed if 5+ steps.
  - Wrap all animations in `@media (prefers-reduced-motion: no-preference) { }`.
- **Depth through shadow only**: Use `box-shadow` for elevation. NEVER use `perspective`, `translateZ`, `rotateX`, `rotateY`, or `transform-style: preserve-3d` on elements with attached SVG lines.
- **Clean surfaces**: No mesh backgrounds, noise textures, heavy decorative effects. No `filter: blur`, `backdrop-filter`, gradients.
- **Compact**: Show essential inline, explain the rest in text.
- **Text goes in your response, visuals go in the tool**: All explanatory text must be OUTSIDE the tool call. The tool output contains ONLY the visual element.
- **Polished details**: Hover states, focus rings matching `var(--ring)`, consistent spacing using 4/8/12/16px increments.

### Streaming

- **HTML**: `<style>` (short) → content HTML → `<script>` last.
- **SVG**: `<defs>` (markers) → visual elements immediately.
- Prefer inline `style="..."` over `<style>` blocks.
- Keep `<style>` under ~15 lines.
- Gradients/shadows/blur flash during streaming — use solid flat fills.

### Rules

- No `<!-- comments -->` or `/* comments */` (waste tokens, break streaming)
- No font-size below 11px
- No emoji — use CSS shapes or SVG paths
- No gradients, drop shadows, blur, glow, or neon effects
- No dark/colored backgrounds on outer containers (transparent only)
- **Typography**: DO NOT override pre-styled elements (h1-h6, p, button, input, textarea, select, label, code, pre, table, th, td, a, hr). Only style custom elements.
  Pre-styled sizes: body 14px/1.6, h1 1.5rem/600, h2 1.25rem/600, h3 1.1rem/600, button 13px/500, input 13px, code/pre 12px mono, table 13px. `.card` `.badge` `.badge.primary` `button.primary` `button.destructive` are pre-styled.
- **Sentence case** always. Never Title Case, never ALL CAPS.
- **No mid-sentence bolding**. Entity names in `code style`, bold for headings/labels only.
- Widget body: `background: transparent`, `padding: 0`. No wrapper div needed.
- Never use `position: fixed`. For modal mockups: use a normal-flow wrapper with `min-height: 400px`.
- No DOCTYPE, `<html>`, `<head>`, or `<body>` — just content fragments.
- **Color pairing rule (CRITICAL)**:
  - `var(--primary)` bg → `var(--primary-foreground)` text
  - `var(--secondary)` bg → `var(--secondary-foreground)` text
  - `var(--destructive)` bg → `var(--destructive-foreground)` text
  - `var(--muted)` bg → `var(--foreground)` text (exception)
  - `var(--accent)` bg → `var(--accent-foreground)` text
  - Custom colored fills → darkest stop from same ramp, never black/gray
- `border-radius: var(--radius)` for elements, `calc(var(--radius) * 1.5)` for cards. SVG default `rx="4"`.
- No rounded corners on single-sided borders.
- No titles or prose inside the tool output.
- Icons: explicit `font-size: 16px` for emoji, `width: 16px; height: 16px` for SVG. Decorative icons 24px max.
- No tabs/carousels/`display: none` during streaming.
- **Horizontal layouts encouraged**: `display: flex; gap: 24px; align-items: stretch`. Each card `flex: 1; min-width: 0`.
- No nested scrolling — auto-fit height.
- Scripts execute after streaming. Load via CDN UMD globals.
- **CDN allowlist (CSP-enforced)**: `cdnjs.cloudflare.com`, `esm.sh`, `cdn.jsdelivr.net`, `unpkg.com` only.

### CSS Variables

| Category | Variables |
|----------|-----------|
| Backgrounds | `--background`, `--muted`, `--card` |
| Text | `--foreground`, `--muted-foreground` |
| Borders | `--border`, `--ring` |
| Semantic | `--destructive`, `--primary` |
| Typography | `--font-sans`, `--font-mono` |
| Layout | `var(--radius)` |

All auto-adapt to light/dark mode.

**Dark mode is mandatory**:
- SVG: use pre-built color classes (`c-blue`, `c-teal`, `c-amber`, etc.). Text classes: `t`, `ts`, `th`.
- HTML: always use CSS variables for text. Never hardcode colors.

### Global Functions

- `sendPrompt(text)` — sends a message to chat as if the user typed it. Use when the user's next step benefits from AI thinking.
- `openLink(url)` — opens a URL in the default browser.
- `<a href="https://...">` clicks are intercepted and open in the default browser.
