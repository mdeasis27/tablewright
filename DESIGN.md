# Tablewright — Visual Identity

A *wright* is a maker: a wheelwright makes wheels, and Tablewright makes tables.
The identity borrows from a joiner's workshop and a draughtsman's sheet: warm
paper, graphite ink, a walnut accent for things you act on, and verdigris (oxidised
brass) for the joints, meaning the foreign keys that hold tables together.

## Wordmark

```
 ┌──┬──┬──┐
 ├──┼──┼──┤   Tablewright
 └──┴──┴──┘
```

- **Mark:** a 3×2 grid drawn with a 2 px graphite stroke on a 24 px square, with
  rounded 2 px corners. The top-left cell (the "id" cell) is filled walnut. It
  ships as an inline SVG component with `aria-hidden="true"`; the adjacent text
  carries the name.
- **Logotype:** "Tablewright" in Fraunces, weight 600, letter-spacing −0.01em.
  The identity lives in the mark plus type, not in custom letterforms.
- **Lockup:** mark + 10 px gap + logotype, baseline aligned. The minimum size is
  a 20 px mark. Below 375 px the tagline drops, but the logotype stays.
- **Tagline:** "Plain English in. Valid SQLite out." in IBM Plex Sans 400,
  using the muted colour.

## Palette

Defined as CSS custom properties on `:root`. The contrast ratios were computed
with the WCAG 2.x formula against `--paper` and `--card`.

| Token | Hex | Role | vs paper | vs card |
|---|---|---|---|---|
| `--paper` | `#F6F1E7` | page background (sawdust paper) | — | — |
| `--card` | `#FFFDF8` | panels, textarea, diagram boxes | — | — |
| `--ink` | `#1F2A2E` | body text, strokes, table headers | 13.06 | 14.46 |
| `--muted` | `#5B6468` | secondary text, column types | 5.38 | 5.96 |
| `--walnut` | `#8A4B2A` | primary actions, PK marker, mark cell | 5.98 | 6.62 |
| `--verdigris` | `#1E6B66` | FK columns, FK edges, focus ring | 5.57 | 6.17 |
| `--ok` | `#2F6B3A` | "Executed in SQLite" status | 5.68 | 6.29 |
| `--err` | `#A3261B` | SQLite error status | 6.54 | 7.25 |
| `--warn` | `#7A5A00` | ignored-sentence warnings | 5.67 | 6.28 |
| `--rule` | `#D9D0BF` | hairlines, grid, borders (decorative only) | — | — |
| `--code-bg` | `#1F2A2E` | DDL panel background; text `#E9F0EE` (12.71) | — | — |

- Text on the walnut buttons is `--card` (6.62:1).
- Colour is never the only signal. Statuses carry an icon and a word ("Valid" /
  "Error"), and FK columns carry a `→ table` suffix as well as the verdigris
  colour.
- The site is light-only by design. The paper metaphor is the identity, and a
  dark theme is out of scope for the MVP.

## Typography

| Use | Family (self-hosted via Fontsource) | Size / weight |
|---|---|---|
| Wordmark, H1 | Fraunces Variable | 28–36 px / 600 |
| Section headings | Fraunces Variable | 18–20 px / 600 |
| UI text, labels, buttons | IBM Plex Sans | 16 px / 400–500 (never below 14 px) |
| Textarea input | IBM Plex Sans | 16 px (prevents zoom-on-focus on iOS) |
| DDL, diagram column names | JetBrains Mono Variable | 13–14 px / 400; table names 600 |

Line height is 1.5 for body text and 1.45 for code. Fallback stacks:
`ui-serif, Georgia`; `system-ui, sans-serif`; `ui-monospace, SFMono-Regular, Consolas, monospace`.

## Layout & components

- **Grid:** a 4 px spacing base (8/12/16/24/32). The max content width is
  1200 px.
  - Below 768 px: a single column (input → status → DDL → diagram).
  - At 768 px and above: two columns (input + status + warnings | DDL +
    diagram).
- **Background detail:** `--paper` with a faint 24 px graph-paper grid in
  `--rule` at 35 % opacity. It is suppressed under the DDL panel.
- **Panels:** `--card` background, a 1 px `--rule` border, 6 px radius, and no
  heavy shadows (only `0 1px 0 var(--rule)`).
- **Buttons:**
  - Primary ("Generate"): solid walnut with card-coloured text, 44 px min
    height.
  - Secondary ("Copy", "Fit"): a 1.5 px ink outline on card.
- **Focus:** every interactive element shows `outline: 3px solid
  var(--verdigris); outline-offset: 2px` on `:focus-visible`. The focusable
  diagram region uses the same ring.
- **ER diagram:**
  - Table boxes: card fill with a 1.5 px ink stroke; header band in ink with
    the table name in card colour (JetBrains Mono 600).
  - Rows: PK rows show a small walnut key glyph; FK rows are verdigris with a
    `→ ref` suffix.
  - Edges: 1.5 px verdigris cubic curves ending in an open arrowhead at the
    referenced table's `id` row.
  - Join tables get a dashed header outline so they read as "joinery".
- **Status badge:** a pill with an icon and text. It reads "Valid — executed in
  SQLite x.y.z, N tables" (ok) or "Error — <sqlite message>" (err), and
  carries `role="status"`.
- **Motion:** only a 120 ms colour/opacity transition on hover and focus, and
  none at all under `prefers-reduced-motion: reduce`.

## Voice

The voice is short, concrete and workshop-flavoured, but never cute in error
messages. Examples: "Generate schema", "Copy DDL", "Ignored 1 sentence that
matched no pattern".
