# Tablewright — System Design & Technical Spec

Inputs: `REQUIREMENTS.md` (normative), `docs/prd/tablewright.prd.md`.
Plan: `docs/plan/slice-plan.md`. Visual identity: `DESIGN.md`.

Where this document and `REQUIREMENTS.md` disagree, `REQUIREMENTS.md` wins.

## 1. Architecture

```
            text ─┐
                  ▼
  src/lib/parse/   sentences → patterns → Model IR (+ warnings)        pure TS
  src/lib/schema/  Model IR → Schema (tables, columns, fks, order)      pure TS
  src/lib/ddl/     Schema → DDL string                                  pure TS
  src/lib/sqlite/  SqlEngine port: exec + introspect                    adapters
                     ├─ bunSqlite.ts   (bun:sqlite — CLI, eval, tests)
                     └─ sqlJs.ts       (sql.js WASM — Next.js server route)
  src/lib/eval/    gold vs introspection → F1 metrics                   pure TS
  src/lib/diagram/ Schema → layout (boxes, edges) for the SVG           pure TS
  src/cli/         generate.ts, eval.ts (thin wrappers over src/lib)
  src/app/         Next.js App Router page + /api/generate route handler
```

Everything that can be scored is pure TypeScript under `src/lib`, with no I/O.
The CLI, the eval and the web app all call the same `generate(text)` function.

### Data types (IR)

```ts
type Warning = { sentence: string; index: number; reason: string };

type Model = {
  entities: ReadonlyMap<string, EntityDecl>; // key = table name (snake singular)
  relations: readonly Relation[];            // in sentence order
  warnings: readonly Warning[];
};
type EntityDecl = { table: string; displayName: string; attributes: readonly string[] };
type Relation =
  | { kind: "fk"; from: string; to: string }          // `from` gets `${to}_id`
  | { kind: "m2m"; a: string; b: string };

type Column = { name: string; type: "INTEGER" | "REAL" | "TEXT";
                primaryKey?: true; references?: string };
type Table  = { name: string; columns: readonly Column[]; isJoin: boolean };
type Schema = { tables: readonly Table[] };             // already in emit order

type GenerateResult = { ddl: string; schema: Schema; warnings: readonly Warning[] };
```

All IR values are built immutably: each stage returns new objects and nothing is
mutated after construction.

## 2. Parser spec (normative for implementation and tests)

### 2.1 Normalisation and sentence splitting
1. Replace CR/LF/tabs with spaces and collapse runs of whitespace.
2. Split on `.` followed by whitespace or end of input. Trim each piece and
   drop empty ones.
3. A non-empty tail without a final `.` still counts as a sentence **[D3]**.
4. Strip the trailing `.`. The leading keywords (`A`, `An`, `Each`, `Many`) and
   the fixed phrases (`has`, `has many`, `belongs to one`, `relate to many`) are
   matched case-insensitively. Entity capitalisation is significant.
   **Implementation note:** never put the `i` flag on a pattern regex, because
   it would make `[A-Z]` match lowercase. Use explicit alternations such as
   `[Aa]n?`, `[Hh]as`, `[Mm]any`.

### 2.2 Tokens
- `ENTITY` = `[A-Z][A-Za-z0-9]*( [A-Z][A-Za-z0-9]*)*`, one or more
  Capitalized words.
- `ART` = `a | an | the`, case-insensitive, as a whole word.

### 2.3 Patterns (tried in this order; first match wins)
| # | Shape (anchored, after normalisation) | Produces |
|---|---|---|
| P1 | `(A\|An) ENTITY1 has many ENTITY2` | `fk(from = singular(E2), to = E1)` |
| P2 | `Each ENTITY1 belongs to one ENTITY2` | `fk(from = E1, to = E2)` |
| P3 | `Many ENTITY_A relate to many ENTITY_B` | `m2m(singular(EA), singular(EB))` |
| P4 | `(A\|An) ENTITY1 has <attr list>` | entity E1 with `attrList(rest)` |

- P1 comes before P4 so that `has many Orders` is never read as an attribute.
  If the word after `has many` is lowercase, P1 fails and P4 applies **[D2]**.
- For P4, if `attrList` yields zero valid attributes (e.g. `A Tag has an id.`),
  the entity is still declared (a table with just `id`) and a warning is also
  emitted.
- A sentence that matches no pattern produces a `Warning` (reason: `"no
  pattern matched"`). The CLI prints it to stderr and the UI lists it.
- Because `ENTITY` only matches Capitalized words, the boundary between the
  entity and the keyword `has` / `belongs` / `relate` is unambiguous.

### 2.4 Attribute lists (P4 tail)
1. Split on `,`. Trim the items.
2. In the **last** item, split on `\s+and\s+`. This covers `a, b and c`, the
   Oxford form `a, b, and c` (the item `and c` loses its leading `and`) and the
   two-item form `a and b`. A leading `and ` on any item is removed.
3. Remove one leading `ART` word from each item, but only if words follow it.
4. Attribute name = lowercase words, joined with `_` after collapsing
   non-`[a-z0-9]` runs. Lenient: input is lowercased first **[D6]**.
   Example: `published year` → `published_year`.
5. Drop empty items. Deduplicate while keeping first-seen order.
   `id` is dropped because it is always the PK.

### 2.5 Names
- `tableName(entity)` = the words split on spaces, each lowercased, joined with
  `_`. Example: `Line Item` → `line_item`. There is no CamelCase hump
  splitting **[D5]**: `LineItem` → `lineitem`, `DVDs` → `dvd`.
- Names that would start with `sqlite_` (reserved by SQLite) get a `t_` prefix.
- An entity used in P2 (both sides), P4, and the subject of P1 is **singular**
  as written.
- An entity in the object of P1 and in both sides of P3 is **plural**. Only its
  last word is singularised.

### 2.6 Singularisation (REQUIREMENTS §1, implemented exactly)
Given a plural entity `W1 … Wn`, apply the following to `Wn`:
1. Candidates, in this order, de-duplicated:
   `ies→y` (if the word ends in `ies`), strip `es` (if it ends in `es`), strip
   `s` (if it ends in `s`).
2. **Known singulars** = the table names of every *singular* mention in the
   whole text (pass 1 collects them before relations are resolved, so sentence
   order doesn't matter).
3. Choose the first candidate whose resulting full table name (earlier words
   plus the candidate) is a known singular.
4. Otherwise use the fallback: `ies→y`; else if the word ends in
   `ses|xes|zes|ches|shes`, strip `es`; else if it ends in `s`, strip `s`;
   else leave it unchanged (it is already singular, e.g. `Many Staff`).
5. Comparison uses table names (lowercase snake), so case never matters.

Examples (pinned by a table-driven test; implement the rule literally and do
**not** "improve" the outputs):
- `Boxes`, no `Box` declared → `box` (fallback `xes`).
- `Categories` → `category`.
- `Courses` → candidates `cours`, `course`. With `Course` declared → `course`.
  **Without** it → fallback `ses` → `cours`.
- `Horses` / `Houses` / `Purchases`, undeclared → `hors` / `hous` / `purchas`.
- `Movies` → candidates `movy`, `movi`, `movie`. With `Movie` declared →
  `movie`. **Without** it → fallback `ies→y` → `movy`.
- `Heroes`, undeclared → `heroe` (strip `s`); with `Hero` declared → `hero`.
- `Quizzes` → candidates `quizz`, `quizze`. `quiz` is never a candidate, so
  the result is `quizz` even when `Quiz` is declared.
- `Statuses` → `status` (`ses`).
- `Buses` with `Bus` declared → `bus`.
- `Line Items` → `line_item`.
- `Employees`, undeclared → `employee` (strip `s`).

### 2.7 Two-pass resolution
- **Pass 1:** match every sentence and collect singular mentions (known
  singulars).
- **Pass 2:** resolve the plural mentions and build the `Model`. Any entity
  that appears only in a relation becomes a table with just `id` (§1 "Other
  rules").
- Repeated declarations of the same entity merge their attributes, in order.
- Duplicate relations are deduplicated **after** singularisation:
  - FKs on `(from, to)`, so `A Customer has many Orders.` plus `Each Order
    belongs to one Customer.` give a single `order.customer_id`.
  - Many-to-many on the sorted pair (the join-table name), so `Many Tags …
    Articles` plus `Many Articles … Tags` give one `article_tag`.
- Table order (mention order) = the order in which each table name is first seen
  across sentences, counting each sentence's subject before its object.

## 3. Schema and DDL conventions (REQUIREMENTS §2, scored exactly)

### 3.1 Columns per table, in order
1. `id INTEGER PRIMARY KEY`.
2. The declared attributes, in declaration order.
3. FK columns `<ref>_id`, in relation sentence order.
4. A column name that already exists is not added twice. For example, an
   attribute `author_id` plus a belongs-to Author yields one column, and that
   column carries the FK.

### 3.2 Join tables (P3)
- `[a, b] = [tA, tB].sort()`, plain JS code-unit order (all names are
  `[a-z0-9_]`, so this is alphabetical). Name `${a}_${b}`.
  Examples: `course_student`, `article_tag`, `group_user`.
- Columns: `id`, `${a}_id → a`, `${b}_id → b`.
- Self relation (`a == b`) **[D1]**: name `${a}_${a}`, columns `id`,
  `${a}_id → a`, `related_${a}_id → a`.
- If a join-table name collides with a declared entity table, the two merge
  (entity attributes plus the join FKs) instead of duplicating the table.

### 3.3 Column types (free choice; deterministic heuristic) **[D7]**
- `INTEGER`: PK and FK columns. Also names ending `_count`, `_year`,
  `_number`, and names whose last word is `year|quantity|stock|credits|age|count|rank|position`.
- `REAL`: names whose last word is
  `price|amount|total|budget|weight|cost|salary|balance|rate`.
- `TEXT`: everything else (dates and `_at`/`_on` included; SQLite has no date
  type).

The scorer ignores types, so the heuristic only improves the DDL's realism.

### 3.4 DDL text
```sql
CREATE TABLE "author" (
  "id" INTEGER PRIMARY KEY,
  "name" TEXT
);

CREATE TABLE "book" (
  "id" INTEGER PRIMARY KEY,
  "title" TEXT,
  "author_id" INTEGER REFERENCES "author"(id)
);
```
- Every identifier is double-quoted. Embedded `"` cannot occur because names are
  restricted to `[a-z0-9_]`, but the quoting helper still escapes `"` → `""`.
- The FK form is exactly `INTEGER REFERENCES "<t>"(id)`, with `(id)` left
  unquoted as in REQUIREMENTS §2. A golden-string test pins it.
- **Emit order:** topological order over FK edges (referenced tables first),
  with ties broken by mention order. Self-edges (`A Category has many
  Categories` → `category.category_id`) are ignored by the sort. A cycle falls
  back to mention order;
  SQLite accepts forward references in `CREATE TABLE` even with
  `foreign_keys = ON`, so the DDL stays valid.
- The output has no `PRAGMA` and no comments. Statements are separated by a
  blank line, and the output ends with one newline. `generate` prints exactly
  this.
- Empty or all-warnings input → empty DDL (an empty string). The CLI prints
  nothing on stdout and exits with code 0.

## 4. SQLite validation and introspection

`SqlEngine` port: `introspect(ddl): Promise<ExecResult>` where
```ts
type ExecResult =
  | { ok: true; tables: Record<string, { columns: string[];
                                        fks: Record<string, string> }> }
  | { ok: false; error: string };
```
Steps: open an in-memory DB → `PRAGMA foreign_keys = ON` → `exec(ddl)` →
read the tables from `sqlite_master` (type = `table`, excluding `sqlite_%`) →
for each table, `PRAGMA table_info` and `PRAGMA foreign_key_list` → close
(in a `finally`).

- **bun:sqlite adapter:** used by the CLI, the eval and the tests. It is
  native and synchronous (wrapped in a Promise for a uniform port).
- **sql.js adapter:** used by `src/app/api/generate/route.ts` on the Node
  server under Next. `serverExternalPackages: ["sql.js"]` lets it load its WASM
  from `node_modules` at runtime. The module is initialised once and cached.
- **Import isolation (no barrel file):** `src/app/**` imports `sqlJs.ts`
  directly, and only `src/cli/**` and the tests import `bunSqlite.ts`.
  `generate()` is engine-free. Any `bun:sqlite` import reachable from the Next
  graph breaks `next build`; a test greps `src/app` and `src/lib` (except the
  adapter itself) to enforce this. The route declares
  `export const runtime = "nodejs"`. `sql.js` belongs in `dependencies`.
- **Parity test:** both adapters return identical `ExecResult` for every
  fixture and for a malformed DDL.

## 5. Eval (REQUIREMENTS §4)
- `bun run eval` → `bun src/cli/eval.ts [fixtures/eval.json]`.
- For each case: `generate(text).ddl` → `introspect` → three sets:
  - `tables` = the table names.
  - `columns` = `table.column` for every column, including `id`.
  - `fks` = `table.column->ref`.
- Gold is built the same way from `gold`.
- `F1(p, g)`: if both sets are empty → 1. Otherwise precision and recall over
  the intersection, and 0 if `p+r = 0`.
- Case score = 0 if execution fails, else `mean(F1t, F1c, F1f)`.
- Aggregates: `table_f1`/`column_f1`/`fk_f1` are means over **all** cases (a
  failed case contributes 0). `exec_rate` = executed / n. `score` = mean case
  score × 100.
- The eval prints exactly one JSON line to stdout with keys in the order
  `cases, exec_rate, table_f1, column_f1, fk_f1, score`. Values are rounded to
  4 decimals (score to 2).
- The fixture file is validated at load. A malformed file → message on stderr,
  exit code 1.

## 6. Web app

- **Route:** `/` (server component shell) + a client component `Workbench`.
- **API:** `POST /api/generate` with body `{ text: string }`. The handler
  validates the input (string, ≤ 20 000 chars, else 400 with a JSON error). It
  runs `generate`, then `introspect` with sql.js, and returns
  `{ ok, data: { ddl, schema, warnings, validation }, error }`, using the
  standard response envelope. The server executes only DDL it generated itself,
  never client SQL.
- **Initial render:** the page server-renders the result for the prefilled
  example (same pipeline), so first paint already shows the DDL, the diagram
  and the status. The page sets `export const dynamic = "force-dynamic"`, so
  sql.js never runs during `next build` prerendering.
- **UI regions:**
  - A textarea led by a `<label>`.
  - A "Generate" button (also Ctrl/Cmd+Enter).
  - The DDL in a `<pre><code>`, with a Copy button that uses the Clipboard
    API, confirms "Copied" through `aria-live`, and falls back to select-all.
  - A validation badge (`role="status"`) showing "Executed in SQLite N.N.N —
    k tables" or the SQLite error.
  - The warnings list.
  - The ER diagram.
- **ER diagram:** the pure `layoutDiagram(schema)` returns boxes and edges, and
  a React component renders the SVG.
  - Layout: layers by longest FK path (referenced tables in the leftmost
    column, join tables to the right of their endpoints). Rows within a layer
    follow mention order. Box height = header + rows × columns.
  - Edges: cubic paths from the FK row's right edge to the referenced table's
    `id` row, with an arrow marker.
  - The SVG has `role="img"`, a `<title>` and `<desc>`. A visually-hidden
    `<ul>` lists "book.author_id → author" for screen readers.
  - At 375 px the diagram scrolls horizontally inside a focusable
    (`tabindex=0`, labelled) region. A "Fit" toggle scales it to the container
    width.
- **Responsive:** a single column below 768 px; two columns (input | output)
  above.
- **A11y:** visible `:focus-visible` ring (see DESIGN.md), contrast ≥ 4.5:1,
  every control labelled, logical tab order, `prefers-reduced-motion`
  respected.

## 7. Decision log (non-interactive run; recommended option chosen)

| ID | Question | Decision | Why |
|---|---|---|---|
| D1 | Self many-to-many column clash | `a_id` + `related_a_id`, table `a_a` | Keeps the DDL valid; the spec gives no rule |
| D2 | `has many` + lowercase word | Treat as attribute list (P4) | The grammar defines an entity as Capitalized |
| D3 | Missing final period | Accept as a sentence | Lenient input, no impact on scoring |
| D4 | Where the web validation runs | Server route with sql.js; DDL is regenerated server-side | No WASM asset plumbing in the browser; never executes client SQL; works with no env vars |
| D5 | CamelCase single word (`LineItem`) | No hump splitting: `lineitem` | The grammar says entities are "Capitalized words", split on spaces; hump splitting risks `DVDs` → `dv_ds` (changed after architect review) |
| D6 | Uppercase letters inside attribute items | Lowercase leniently rather than warn | Robust to sloppy input; grammar-conforming input is unaffected |
| D7 | Column types | Name-based heuristic (INTEGER/REAL/TEXT) | Free choice; more realistic DDL |
| D8 | Engine for CLI and eval | `bun:sqlite` | The fixed runtime is Bun; real native SQLite; synchronous |
| D9 | Linter | Biome 2 (`noExplicitAny`, `noTsIgnore` as errors) | One fast tool for lint and format; enforces the no-`any` rule |
| D10 | TypeScript version | 5.9.x (not 7.x) | 7.x is the new native port; Next 16 tooling is proven on 5.9 |
| D11 | Fonts | Self-hosted `@fontsource*` packages | `next/font/google` needs the network at build time |
| D12 | E2E | Browser check through Chrome DevTools MCP during the build, plus an optional Playwright smoke test (`*.e2e.ts`, outside `bun test` discovery) | `bun test` must stay hermetic; browsers may be unavailable offline |
| D13 | PRD location | `docs/prd/` instead of `.claude/prds/` | `.claude/` is git-ignored |
| D14 | Next build lint | Next 16 no longer lints during build; `lint` = `biome check .` | Avoids a duplicate ESLint setup |
| D15 | Package versions | next 16.4, react 19.3, sql.js 1.15, @biomejs/biome 2.5, typescript 5.9.3, @types/bun 1.4 | Latest stable at planning time (2026-10-16) |
| D16 | Prior art | None reusable (gh search empty); grammar is bespoke | Reuse happens at library level (sql.js, bun:sqlite) |
| D17 | Script runner | `"generate": "bun src/cli/generate.ts"`; `bun run` echoes only to stderr | stdout must contain the DDL only |
| D18 | Biome scope | `files.includes: ["**", "!.next", "!node_modules", "!fixtures", "!coverage", "!next-env.d.ts"]` | Biome 2 dropped `files.ignore`; the fixtures must not be reformatted |
| D19 | Node for Next | `dev`/`build` call `next` (Node shebang). Node ≥ 20.9 is required next to Bun (present: v22) and documented in the README. Fallback: `bun --bun next …` if Node is absent | Next's CLI is Node-first; verified at S0 |
| D20 | tsconfig `types` | Leave unset so `@types/bun` loads everywhere; one program for `tsc --noEmit` | One tsconfig cannot scope types per folder |
| D21 | `next-env.d.ts` | Committed (not ignored) | `typecheck` passes on a fresh clone before any build |
| D22 | Commit trailer | Keep `Co-Authored-By` | The session's harness attribution instruction asks for it |
| D23 | Review | Architect review applied: §2.1 regex note, §2.3 empty P4, §2.6 literal examples, §2.7 dedupe, §3.4 self-edge, §4 import isolation, §6 force-dynamic | Recorded for traceability |

## 8. Security notes
- User input is handled in one place, `/api/generate`, with a type and length
  limit. The parser is regex-based with anchored, linear patterns: no nested
  quantifiers over overlapping classes, so no ReDoS. A test feeds it a 20 000-char
  adversarial string under a time budget.
- No raw SQL from the client is ever executed. Identifiers are restricted to
  `[a-z0-9_]` and also quoted.
- No secrets, no env vars, no outbound network.
- The UI renders DDL and warnings as text nodes only (no
  `dangerouslySetInnerHTML`).
