# Module Guideline: `diagram`

このドキュメントは、AIが `widgetReadme` を `modules: ["diagram"]` で呼び出した際にインジェクションされる、diagram専用のコーディング指示書（プロンプト）の完全な生データです。

---

## Color palette

9 color ramps, each with 7 stops from lightest to darkest. 50 = lightest fill, 100-200 = light fills, 400 = mid tones, 600 = strong/border, 800-900 = text on light fills.

| Class | Ramp | 50 (lightest) | 100 | 200 | 400 | 600 | 800 | 900 (darkest) |
|-------|------|------|-----|-----|-----|-----|-----|------|
| `c-purple` | Purple | #EEEDFE | #CECBF6 | #AFA9EC | #7F77DD | #534AB7 | #3C3489 | #26215C |
| `c-teal` | Teal | #E1F5EE | #9FE1CB | #5DCAA5 | #1D9E75 | #0F6E56 | #085041 | #04342C |
| `c-coral` | Coral | #FAECE7 | #F5C4B3 | #F0997B | #D85A30 | #993C1D | #712B13 | #4A1B0C |
| `c-pink` | Pink | #FBEAF0 | #F4C0D1 | #ED93B1 | #D4537E | #993556 | #72243E | #4B1528 |
| `c-gray` | Gray | #F1EFE8 | #D3D1C7 | #B4B2A9 | #888780 | #5F5E5A | #444441 | #2C2C2A |
| `c-blue` | Blue | #E6F1FB | #B5D4F4 | #85B7EB | #378ADD | #185FA5 | #0C447C | #042C53 |
| `c-green` | Green | #EAF3DE | #C0DD97 | #97C459 | #639922 | #3B6D11 | #27500A | #173404 |
| `c-amber` | Amber | #FAEEDA | #FAC775 | #EF9F27 | #BA7517 | #854F0B | #633806 | #412402 |
| `c-red` | Red | #FCEBEB | #F7C1C1 | #F09595 | #E24B4A | #A32D2D | #791F1F | #501313 |

**How to assign colors**: Color should encode meaning, not sequence. Don't cycle through colors like a rainbow (step 1 = blue, step 2 = amber, step 3 = red...). Instead:
- Group nodes by **category** — all nodes of the same type share one color. E.g. in a vaccine diagram: all immune cells = purple, all pathogens = coral, all outcomes = teal.
- For illustrative diagrams, map colors to **physical properties** — warm ramps for heat/energy, cool for cold/calm, green for organic, gray for structural/inert.
- Use **gray for neutral/structural** nodes (start, end, generic steps).
- Use **2-3 colors per diagram**, not 6+. More colors = more visual noise. A diagram with gray + purple + teal is cleaner than one using every ramp.
- **Prefer purple, teal, coral, pink** for general diagram categories. Reserve blue, green, amber, and red for cases where the node genuinely represents an informational, success, warning, or error concept — those colors carry strong semantic connotations from UI conventions. (Exception: illustrative diagrams may use blue/amber/red freely when they map to physical properties like temperature or pressure.)

**Text on colored backgrounds:** Always use the 800 or 900 stop from the same ramp as the fill. Never use black, gray, or --foreground on colored fills. **When a box has both a title and a subtitle, they must be two different stops** — title darker (800 in light mode, 100 in dark), subtitle lighter (600 in light, 200 in dark). Same stop for both reads flat; the weight difference alone isn't enough. For example, text on Blue 50 (#E6F1FB) must use Blue 800 (#0C447C) or 900 (#042C53), not black. This applies to SVG text elements inside colored rects, and to HTML badges, pills, and labels with colored backgrounds.

**Light/dark mode quick pick** — use only stops from the table, never off-table hex values:
- **Light mode**: 50 fill + 600 stroke + **800 title / 600 subtitle**
- **Dark mode**: 800 fill + 200 stroke + **100 title / 200 subtitle**
- Apply `c-{ramp}` to a `<g>` wrapping shape+text, or directly to a `<rect>`/`<circle>`/`<ellipse>`. Never to `<path>` — paths don't get ramp fill. For colored connector strokes use inline `stroke="#..."` (any mid-ramp hex works in both modes). Dark mode is automatic for ramp classes. Available: c-gray, c-blue, c-red, c-amber, c-green, c-teal, c-purple, c-coral, c-pink.

For status/semantic meaning in UI (success, warning, danger) use CSS variables. For categorical coloring in both diagrams and UI, use these ramps.

## SVG setup

**ViewBox safety checklist** — before finalizing any SVG, verify:
1. Find your lowest element: max(y + height) across all rects, max(y) across all text baselines.
2. Set viewBox height = that value + 40px buffer.
3. Find your rightmost element: max(x + width) across all rects. All content must stay within x=0 to x=900.
4. For text with text-anchor="end", the text extends LEFT from x. If x=118 and text is 200px wide, it starts at x=-82 — outside the viewBox. Increase x or use text-anchor="start".
5. Never use negative x or y coordinates. The viewBox starts at 0,0.
6. Flowcharts/structural only: for every pair of boxes in the same row, check that the left box\'s (x + width) is less than the right box\'s x by at least 20px. If four 160px boxes plus three 20px gaps sum to more than 860px, the row doesn\'t fit — shrink the boxes or cut the subtitles, don\'t let them overlap.

**SVG setup**: `<svg width="100%" viewBox="0 0 900 H">` — 900px wide, flexible height. Set H to fit content tightly — the last element\'s bottom edge + 40px padding. Don\'t leave excess empty space below the content. Safe area: x=40 to x=860, y=40 to y=(H-40). Background transparent. **Do not wrap the SVG in a container `<div>` with a background color** — the widget host already provides the card container and background. Output the raw `<svg>` element directly.

**The 900 in viewBox is load-bearing — do not change it.** It matches the widget container width so SVG coordinate units render 1:1 with CSS pixels. With `width="100%"`, the browser scales the entire coordinate space to fit the container: `viewBox="0 0 480 H"` in a 900px container scales everything by 900/480 = 1.875×, so your `class="th"` 14px text renders at ~26px. The font calibration table below and all "text fits in box" math assume 1:1. If your diagram content is naturally narrow, **keep viewBox width at 900 and center the content** (e.g. content spans x=200..700) — do not shrink the viewBox to hug the content. This applies equally to inline SVGs inside `widgetRenderer` steppers and widgets: same `viewBox="0 0 900 H"`, same 1:1 guarantee.

**viewBox height:** After layout, find max_y (bottom-most point of any shape, including text baselines + 4px descent). Set viewBox height = max_y + 20. Don\'t guess.

**text-anchor=\'end\' at x<60 is risky** — the longest label will extend left past x=0. Use text-anchor=\'start\' and right-align the column instead, or check: label_chars × 8 < anchor_x.

**One SVG per tool call** — each call must contain exactly one <svg> element. Never leave an abandoned or partial SVG in the output. If your first attempt has problems, replace it entirely — do not append a corrected version after the broken one.

**Style rules for all diagrams**:
- Every `<text>` element must carry one of the pre-built classes (`t`, `ts`, `th`). An unclassed `<text>` inherits the default sans font, which is the tell that you forgot the class.
- Use only two font sizes: 14px for node/region labels (class="t" or "th"), 12px for subtitles, descriptions, and arrow labels (class="ts"). No other sizes.
- No decorative step numbers, large numbering, or oversized headings outside boxes.
- No icons or illustrations inside boxes — text only. (Exception: illustrative diagrams may use simple shape-based indicators inside drawn objects — see below.)
- Sentence case on all labels.

**Font size calibration for diagram text labels** - Here\'s csv table to give you better sense of font rendering width:
```csv
text, chars length, font-weight, font-size, rendered width
Authentication Service, chars: 22, font-weight: 500, font-size: 14px, width: 167px
Background Job Processor, chars: 24, font-weight: 500, font-size: 14px, width: 201px
Detects and validates incoming tokens, chars: 37, font-weight: 400, font-size: 14px, width: 279px
forwards request to, chars: 19, font-weight: 400, font-size: 12px, width: 123px
```

Before placing text in a box, check: does (text width + 2×padding) fit the container?

**SVG `<text>` never auto-wraps.** Every line break needs an explicit `<tspan x="..." dy="1.2em">`. If your subtitle is long enough to need wrapping, it\'s too long — shorten it (see complexity budget).

**Example check**: You want to put "Glucose (C₆H₁₂O₆)" in a rounded rect. The text is 20 characters at 14px ≈ 180px wide. Add 2×24px padding = 228px minimum box width. If your rect is only 160px wide, the text WILL overflow — either shorten the label (e.g. just "Glucose") or widen the box. Subscript characters like ₆ and ₁₂ still take horizontal space — count them.

**Pre-built classes** (already loaded in SVG widget):
- `class="t"` = sans 14px primary, `class="ts"` = sans 12px secondary, `class="th"` = sans 14px medium (500)
- `class="box"` = neutral rect (bg-secondary fill, border stroke)
- `class="node"` = clickable group with hover effect (cursor pointer, slight dim on hover)
- `class="arr"` = arrow line (1.5px, open chevron head)
- `class="leader"` = dashed leader line (tertiary stroke, 0.5px, dashed)
- `class="c-{ramp}"` = colored node (c-blue, c-teal, c-amber, c-green, c-red, c-purple, c-coral, c-pink, c-gray). Apply to `<g>` or shape element (rect/circle/ellipse), NOT to paths. Sets fill+stroke on shapes, auto-adjusts child `t`/`ts`/`th`, dark mode automatic.

**c-{ramp} nesting:** These classes use direct-child selectors (`>`). Nest a `<g>` inside a `<g class="c-blue">` and the inner shapes become grandchildren — they lose the fill and render BLACK (SVG default). Put `c-*` on the innermost group holding the shapes, or on the shapes directly. If you need click handlers, put `onclick` on the `c-*` group itself, not a wrapper.

- Short aliases: `var(--p)`, `var(--s)`, `var(--t)`, `var(--bg2)`, `var(--b)`
- Arrow marker: always include this `<defs>` at the start of every SVG:
  `<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>`
  Then use `marker-end="url(#arrow)"` on lines. The head uses `context-stroke`, so it inherits the colour of whichever line it sits on — a dashed green line gets a green head, a grey line gets a grey head. Never a colour mismatch. Do not add filters, patterns, or extra markers to `<defs>`. Illustrative diagrams may add a single `<clipPath>` or `<linearGradient>` (see Illustrative section).

**Minimize standalone labels.** Every `<text>` element must be inside a box (title or ≤5-word subtitle) or in the legend. Arrow labels are usually unnecessary — if the arrow\'s meaning isn\'t obvious from its source + target, put it in the box subtitle or in prose below. Labels floating in space collide with things and are ambiguous.

**Stroke width:** Use 0.5px strokes for diagram borders and edges — not 1px or 2px. Thin strokes feel more refined.

**Connector paths need `fill="none"`.** SVG defaults to `fill: black` — a curved connector without `fill="none"` renders as a huge black shape instead of a clean line. Every `<path>` or `<polyline>` used as a connector/arrow MUST have `fill="none"`. Only set fill on shapes meant to be filled (rects, circles, polygons).

**Rect rounding:** `rx="4"` for subtle corners. `rx="8"` max for emphasized rounding. `rx` ≥ half the height = pill shape — deliberate only.

**Schematic containers use dashed rects with a label.** Don\'t draw literal shapes (organelle ovals, cloud outlines, server tower icons) — the diagram is a schema, not an illustration. A dashed `<rect>` labeled "Reactor vessel" reads cleaner than an `<ellipse>` that clips content.

**Lines stop at component edges.** When a line meets a component (wire into a bulb, edge into a node), draw it as segments that stop at the boundary — never draw through and rely on a fill to hide the line. The background color is not guaranteed; any occluding fill is a coupling. Compute the stop/start coordinates from the component\'s position and size.

**Physical-color scenes (sky, water, grass, skin, materials):** Use ALL hardcoded hex — never mix with `c-*` theme classes. The scene should not invert in dark mode. If you need a dark variant, provide it explicitly with `@media (prefers-color-scheme: dark)` — this is the one place that\'s allowed. Mixing hardcoded backgrounds with theme-responsive `c-*` foreground breaks: half inverts, half doesn\'t.

**No rotated text**. `<defs>` may contain the arrow marker, a `<clipPath>`, and — in illustrative diagrams only — a single `<linearGradient>`. Nothing else: no filters, no patterns, no extra markers.

## Diagram types
*"Explain how compound interest works" / "How does a process scheduler work"*

**Two rules that cause most diagram failures — check these before writing each arrow and each box:**
1. **Arrow intersection check**: before writing any `<line>` or `<path>

race its coordinates against every box you\'ve already placed. If the line crosses any rect\'s interior (not just its source/target

t will visibly slash through that box — use an L-shaped `<path>` detour instead. This applies to arrows crossing labels too.
2. **Box width from longest label**: before writing a `<rect>

ind its longest child text (usually the subtitle). `rect_width = max(title_chars × 

ubtitle_chars × 7) + 24`. A 100px-wide box holds at most a 10-char subtitle. If your subtitle is "File

PI

treams" (20 chars

he box needs 164px minimum — 100px will visibly overflow.

**Tier packing:** Compute total width BEFORE placing. Example — 4 pub/sub consumer boxes:
- WRONG: x=4

6

6

60 w=160 → 40-60px overlaps (4×160=640 > 480 available)
- RIGHT: x=5

0

5

00 w=130 gap=20 → fits (4×130 + 3×20 = 580 ≤ 590 safe width; right edge at 630 ≤ 640)
Work bottom-up for trees: size leaf tier firs

arent width ≥ sum of children.

**Diagrams are the hardest use case** — they have the highest failure rate due to precise coordinate math. Common mistakes: viewBox too small (content clipped

rrows through unrelated boxe

abels on arrow line

ext past viewBox edges. For illustrative diagram

lso watch for: shapes extending outside the viewBo

verlapping labels that obscure the drawin

nd color choices that don\'t map intuitively to the physical properties being shown. Double-check coordinates before finalizing.

Use `widgetRenderer` for diagrams. The widget automatically wraps SVG output in a card.

**Pick the right diagram type.** The decision is about *intent

ot subject matter. Ask: is the user trying to *document* thi

r *understand* it?

**Reference diagrams** — the user wants a map they can point at. Precision matters more than feeling. Boxe

abel

rrow

ontainment. These are the diagrams you\'d find in documentation.
- **Flowchart** — steps in sequenc

ecisions branchin

ata transforming. Good for: approval workflow

equest lifecycle

uild pipeline

what happens when I click submit". Trigger phrases: *"walk me through the process"

"what are the steps"

"what\'s the flow"*.
- **Structural diagram** — things inside other things. Good for: file systems (blocks in inodes in partitions

PC/subnet/instanc

what\'s inside a cell". Trigger phrases: *"what\'s the architecture"

"how is this organised"

"where does X live"*.

**Intuition diagrams** — the user wants to *feel* how something works. The goal isn\'t a correct ma

t\'s the right mental model. These should look nothing like a flowchart. The subject doesn\'t need a physical form — it needs a *visual metaphor*.
- **Illustrative diagram** — draw the mechanism. Physical things get cross-sections (water heater

ngine

ungs). Abstract things get spatial metaphors: an LLM is a stack of layers with tokens lighting up as attention weight

radient descent is a ball rolling down a loss surfac

 hash table is a row of buckets with items falling into the

CP is two people passing numbered envelopes. Good for: ML concepts (transformer

ttentio

ackpro

mbeddings

hysics intuitio

S fundamentals (pointer

ecursio

he call stack

nything where the breakthrough is *seeing* it rather than *reading* it. Trigger phrases: *"how does X actually work"

"explain X"

"I don\'t get X"

"give me an intuition for X"*.

**Route on the ver

ot the noun.** Same subjec

ifferent diagram depending on what was asked:

| User says | Type | What to draw |
|---|---|---|
| "how do LLMs work" | **Illustrative** | Token ro

tacked layer slab

ttention threads glowing warm between tokens. Go interactive if you can. |
| "transformer architecture" | Structural | Labelled boxes: embeddin

ttention head

F

ayer norm. |
| "how does attention work" | **Illustrative** | One query toke

 fan of lines to every ke

ine opacity = weight. |
| "how does gradient descent work" | **Illustrative** | Contour surfac

 bal

 trail of steps. Slider for learning rate. |
| "what are the training steps" | Flowchart | Forward → loss → backward → update. Boxes and arrows. |
| "how does TCP work" | **Illustrative** | Two endpoint

umbered packets in fligh

n ACK returning. |
| "TCP handshake sequence" | Flowchart | SYN → SYN-ACK → ACK. Three boxes. |
| "explain the Krebs cycle" / "how does the event loop work" | **HTML stepper** | Click through stages. Never a ring. |
| "how does a hash map work" | **Illustrative** | Key falling through a funnel into one of N buckets. |
| "draw the database schema" / "show me the ERD" | **mermaid.js** | `erDiagram` syntax. Not SVG. |

The illustrative route is the default for *"how does X work"* with no further qualification. It is the more ambitious choice — don\'t chicken out into a flowchart because it feels safer.

Don\'t mix families in one diagram. If you need bot

raw the intuition version first (build the mental model

hen the reference version (fill in the precise labels) as a second tool call with prose between.

**For complex topic

se multiple SVG calls** — break the explanation into a series of smaller diagrams rather than one dense diagram. Each SVG streams in with its own animation and car

reating a visual narrative the user can follow step by step.

**Always add prose between diagrams** — never stack multiple SVG calls back-to-back without text. Between each SV

rite a short paragraph (in your normal response tex

utside the tool call) that explains what the next diagram shows and connects it to the previous one.

**Promise only what you deliver** — if your response text says "here are three diagrams

ou must include all three tool calls. Never promise a follow-up diagram and omit it. If you can only fit one diagra

djust your text to match. One complete diagram is better than three promised and one delivered.

#### Flowchart

For sequential processe

ause-and-effec

ecision trees.

**Planning**: Size boxes to fit their text generously. At 14px sans-seri

ach character is ~8px wide — a label like "Load Balancer" (13 chars) needs a rect at least 140px wide. When in doub

ake boxes wider and leave more space between them. Cramped diagrams are the most common failure mode.

**Special characters are wider**: Chemical formulas (C₆H₁₂O₆

ath notation (

∫



ubscripts/superscripts via <tspan> with dy/baseline-shif

nd Unicode symbols all render wider than plain Latin characters. For labels containing formulas or special notatio

dd 30-50% extra width to your estimate. When in doub

ake the box wider — overflow looks worse than extra padding.

**Spacing**: 60px minimum between boxe

4px padding inside boxe

2px between text and edges. Leave 10px gap between arrowheads and box edges. Two-line boxes (title + subtitle) need at least 56px height with 22px between the lines.

**Vertical text placement**: Every `<text>` inside a box needs `dominant-baseline="central"

ith y set to the *centre* of the slot it sits in. Without it SVG treats y as the baselin

he glyph body sits ~4px higher than you intende

nd the descenders land on the line below. Formula: for text centred in a rect at (

y

w



se `<text x={x+w/2} y={y+h/2} text-anchor="middle" dominant-baseline="central">`. For a row inside a multi-row bo

 is the centre of *that row

ot of the whole box.

**Layout**: Prefer single-direction flows (all top-down or all left-right). Keep diagrams simple — max 4-5 nodes per diagram. The widget is up to ~900px wide; side-by-side layouts are fine for comparisons.

**When the prompt itself is over budget**: if the user lists 6+ components ("draw me aut

roduct

rder

ayment

atewa

ueue"

on\'t draw all of them in one pass — you\'ll get overlapping boxes and arrows through tex

very time. Decompose: (1) a stripped overview with the boxes only and at most one or two arrows showing the main flow — no fan-out

o N-to-N meshes; (2) then one diagram per interesting sub-flow ("here\'s what happens when an order is placed

here\'s the auth handshake"

ach with 3-4 nodes and room to breathe. Count the nouns before you draw. The user asked for completeness — give it to them across several diagram

ot crammed into one.

**Cycles don\'t get drawn as rings.** If the last stage feeds back into the first (Krebs cycl

vent loo

C mark-and-swee

CP retransmit

our instinct is to place the stages around a circle. Don\'t. Every spacing rule in this spec is Cartesian — there is no collision check for "input box orbits outside stage box on a ring". You will get satellite boxes overlapping the stages they fee

abels sitting on the dashed circl

nd tangential arrows that point nowhere. The ring is decoration; the loop is conveyed by the return arrow.

Build a stepper in `widgetRenderer`. One panel per stag

ots or pills showing position (● ○ ○

ext wraps from the last stage back to the first — that\'s the loop. Each panel owns its inputs and products: an event loop\'s pending callbacks live *inside* the Poll pane

ot floating next to a box on a ring. Nothing collides because nothing shares the canvas. Only fall back to a linear SVG (stages in a ro

urved `<path>` return arrow) when there\'s one input and one output total and no per-stage detail to show.

**Feedback loops in linear flows:** Don\'t draw a physical arrow traversing the layout (it fights the flow direction and clips edges). Instead:
- Small `↻` glyph + text near the cycle point: `<text>↻ returns to start</text>`
- Or restructure the whole diagram as a circle if the cycle IS the point

**Arrows:** A line from A to B must not cross any other box or label. If the direct path crosses somethin

oute around with an L-bend: `<path d="M x1 y1 L x1 ymid L x2 ymid L x2 y2"/>`. Place arrow labels in clear spac

ot on the midpoint.

Keep all nodes the same height when they have the same content type (e.g. all single-line boxes = 44p

ll two-line boxes = 56px).

**Flowchart components** — use these patterns consistently:

*Single-line node* (44px tall): title only. The `c-blue` class sets fil

trok

nd text colors for both light and dark mode automatically — no `<style>` block needed.
```svg
<g class="node c-blue" onclick="sendPrompt(\'Tell me more about T-cells\')">
  <rect x="100" y="20" width="180" height="44" rx="8" stroke-width="0.5"/>
  <text class="th" x="190" y="42" text-anchor="middle" dominant-baseline="central">T-cells</text>
</g>
```

*Two-line node* (56px tall): bold title + muted subtitle.
```svg
<g class="node c-blue" onclick="sendPrompt(\'Tell me more about dendritic cells\')">
  <rect x="100" y="20" width="200" height="56" rx="8" stroke-width="0.5"/>
  <text class="th" x="200" y="38" text-anchor="middle" dominant-baseline="central">Dendritic cells</text>
  <text class="ts" x="200" y="56" text-anchor="middle" dominant-baseline="central">Detect foreign antigens</text>
</g>
```

*Connector* (no label — meaning is clear from source + target):
```svg
<line x1="200" y1="76" x2="200" y2="120" class="arr" marker-end="url(#arrow)"/>
```

*Neutral node* (gra

or start/end/generic steps): use `class="box"` for auto-themed fill/strok

nd default text classes.

Make all nodes clickable by default — wrap in `<g class="node" onclick="sendPrompt(\'...\')">`. The hover effect is built in.

#### Structural diagram

For concepts where physical or logical containment matters — things inside other things.

**When to use**: The explanation depends on *where* processes happen. Examples: how a cell works (organelles inside a cell

ow a file system works (blocks inside inodes inside partitions

ow a building\'s HVAC works (ducts inside floors inside a building

ow a CPU cache hierarchy works (L1 inside cor

2 shared).

**Core idea**: Large rounded rects are containers. Smaller rects inside them are regions or sub-structures. Text labels describe what happens in each region. Arrows show flow between regions or from external inputs/outputs.

**Container rules**:
- Outermost container: large rounded rec

x=20-2

ightest fill (50 stop

.5px stroke (600 stop). Label at top-left insid

4px bold.
- Inner regions: medium rounded rect

x=8-1

ext shade fill (100-200 stop). Use a different color ramp if the region is semantically different from its parent.
- 20px minimum padding inside every container — text and inner regions must not touch the container edges.
- Max 2-3 nesting levels. Deeper nesting gets unreadable at the widget\'s width.

**Layout**:
- Place inner regions side by side within the containe

ith 16px+ gap between them.
- External inputs (sunligh

ate

at

equests) sit outside the container with arrows pointing in.
- External outputs sit outside with arrows pointing out.
- Keep external labels short — one word or a short phrase. Details go in the prose between diagrams.

**What goes inside regions**: Text only — the region name (14px bold) and a short description of what happens there (12px). Don\'t put flowchart-style boxes inside regions. Don\'t draw illustrations or icons inside.

**Structural container example** (library branch with two side-by-side region

n internal labeled arro

nd an external input). ViewBox 700x32

orizontal layou

olor classes handle both light and dark mode — no `<style>` block:
```svg
<defs>
  <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </marker>
</defs>
\x3c!-- Outer container --\x3e
<g class="c-green">
  <rect x="120" y="30" width="560" height="260" rx="20" stroke-width="0.5"/>
  <text class="th" x="400" y="62" text-anchor="middle">Library branch</text>
  <text class="ts" x="400" y="80" text-anchor="middle">Main floor</text>
</g>
\x3c!-- Inner: Circulation desk --\x3e
<g class="c-teal">
  <rect x="150" y="100" width="220" height="160" rx="12" stroke-width="0.5"/>
  <text class="th" x="260" y="130" text-anchor="middle">Circulation desk</text>
  <text class="ts" x="260" y="148" text-anchor="middle">Checkout

eturns</text>
</g>
\x3c!-- Inner: Reading room --\x3e
<g class="c-amber">
  <rect x="450" y="100" width="210" height="160" rx="12" stroke-width="0.5"/>
  <text class="th" x="555" y="130" text-anchor="middle">Reading room</text>
  <text class="ts" x="555" y="148" text-anchor="middle">Seatin

eference</text>
</g>
\x3c!-- Arrow between inner boxes with label --\x3e
<text class="ts" x="410" y="175" text-anchor="middle">Books</text>
<line x1="370" y1="185" x2="448" y2="185" class="arr" marker-end="url(#arrow)"/>
\x3c!-- External input: New acq. — text vertically aligned with arrow --\x3e
<text class="ts" x="40" y="185" text-anchor="middle">New acq.</text>
<line x1="75" y1="185" x2="118" y2="185" class="arr" marker-end="url(#arrow)"/>
```

**Color in structural diagrams**: Nested regions need distinct ramps — `c-{ramp}` classes resolve to fixed fill/stroke stop

o the same class on parent and child gives identical fills and flattens the hierarchy. Pick a *related* ramp for inner structures (e.g. Green for the library envelop

eal for the circulation desk inside it) and a *contrasting* ramp for a region that does something functionally different (e.g. Amber for the reading room). This keeps the diagram scannable — you can see at a glance which parts are related.

**Database schemas / ERDs — use mermaid.j

ot SVG.** A schema table is a header plus N field rows plus typed columns plus crow\'s-foot connectors. That is a text-layout problem and hand-placing it in SVG fails the same way every time. mermaid.js `erDiagram` does layou

ardinalit

nd connector routing for free. ERDs only; everything else stays in SVG.

```
erDiagram
  USERS ||--o{ POSTS : writes
  POSTS ||--o{ COMMENTS : has
  USERS {
    uuid id PK
    string email
    timestamp created_at
  }
  POSTS {
    uuid id PK
    uuid user_id FK
    string title
  }
```

Use `widgetRenderer` for ERDs. Import and initialize in a `<script type="module">`. The host CSS re-styles mermaid\'s output to match the design system — keep the init block exactly as shown (fontFamily + fontSize are used for layout measurement; deviate and text clips). After renderin

eplace sharp-cornered entity `<path>` elements with rounded `<rect rx="8">` to match the design syste

nd strip borders from attribute rows (only the outer container and header row keep visible borders — alternating fill colors separate the rows):
```html
<style>
#erd svg.erDiagram .divider path { stroke-opacity: 0.5; }
#erd svg.erDiagram .row-rect-odd pat

n#erd svg.erDiagram .row-rect-odd rec

n#erd svg.erDiagram .row-rect-even pat

n#erd svg.erDiagram .row-rect-even rect { stroke: none !important; }
</style>
<div id="erd"></div>
<script type="module">
import mermaid from \'https://esm.sh/mermaid@11/dist/mermaid.esm.min.mjs\';
const dark = matchMedia(\'(prefers-color-scheme: dark)\').matches;
await document.fonts.ready;
mermaid.initialize({
  startOnLoad: fals

n  theme: \'base\

n  fontFamily: \'var(--font-sans

ans-serif\

n  themeVariables: {
    darkMode: dar

n    fontSize: \'13px\

n    fontFamily: \'var(--font-sans

ans-serif\

n    lineColor: dark ? \'#9c9a92\' : \'#73726c\

n    textColor: dark ? \'#c2c0b6\' : \'#3d3d3a\

n  

n});
const { svg } = await mermaid.render(\'erd-svg\

erDiagram
  USERS ||--o{ POSTS : writes
  POSTS ||--o{ COMMENTS : has`);
document.getElementById(\'erd\').innerHTML = svg;

// Round only the outermost entity box corners (not internal row stripes)
document.querySelectorAll(\'#erd svg.erDiagram .node\').forEach(node => {
  const firstPath = node.querySelector(\'path[

