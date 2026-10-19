# Tablewright: plain English to a validated SQLite schema

Build a small web app plus CLI. The user describes a data model in restricted English. The
app generates SQLite DDL, validates it by executing it in a real SQLite engine and draws an
ER diagram.

No LLM and no API keys: generation is deterministic and rule-based, following the grammar
below.

## 1. Input grammar

Input is English text made of sentences that end with `.`. Sentences can appear in any
order.

- **Entity names** are one or more Capitalized words (`Book`, `Line Item`,
  `Gym Class Session`).
- **Attribute names** are lowercase words.

| Pattern | Meaning |
|---|---|
| `A <Entity> has <attr list>.` (or `An`) | Entity with those attribute columns. |
| `Each <Entity> belongs to one <Entity2>.` | `<entity>` gets FK column `<entity2>_id` → `<entity2>.id`. |
| `A <Entity> has many <Entities2>.` (or `An`) | `<entity2>` gets FK column `<entity>_id` → `<entity>.id`. |
| `Many <EntitiesA> relate to many <EntitiesB>.` | Join table, see naming rules. |

**Attribute lists:**
- Items are separated by commas.
- The last item is joined with `and`, with or without an Oxford comma.
- Each item may start with an article (`a`, `an`, `the`), which is ignored.
- Multi-word attributes become snake_case: `published year` → `published_year`.

**Plurals:** in `has many` and `relate to many`, plurals apply to the last word of the
entity name. To get the singular:
- Generate candidates: `ies`→`y`, strip `es`, strip `s`.
- Prefer a candidate that appears as a singular entity elsewhere in the text.
- If none does, use: `ies`→`y`; else, if the word ends in `ses`/`xes`/`zes`/`ches`/`shes`,
  strip `es`; else strip `s`.

**Other rules:**
- An entity mentioned only in a relationship still becomes a table, with just `id`.
- Sentences that match no pattern are ignored and reported as warnings (in the UI and on
  stderr in the CLI).

## 2. Output conventions (scored exactly)

- **Table name:** singular snake_case of the entity name (`Line Item` → `line_item`).
- **Primary key:** every table has `id INTEGER PRIMARY KEY` as its first column.
- **FK columns:** `<referenced_table>_id INTEGER REFERENCES "<referenced_table>"(id)`.
- **Join tables:**
  - Name: `<a>_<b>`, with the two table names sorted alphabetically.
  - Columns: `id`, `<a>_id`, `<b>_id`, both FK.
- **Column types:** free choice, but the DDL must be valid SQLite.
- **Quoting:** all identifiers are double-quoted, because names like `order`, `group` or
  `match` are reserved words.
- **Execution:** the DDL must execute top to bottom in one SQLite connection with
  `PRAGMA foreign_keys = ON`.

## 3. Deliverables

**Stack (fixed):**
- Bun as package manager and runtime.
- Next.js App Router.
- TypeScript strict, with no `any` and no `@ts-ignore`.
- Tests run with `bun test`.

**Required `package.json` scripts:**

| Script | Must do |
|---|---|
| `dev`, `build` | Run and build the web app |
| `test` | Unit tests pass |
| `typecheck` | `tsc --noEmit` passes |
| `lint` | Linter of your choice passes |
| `generate <file>` | Prints the DDL for the text in `<file>` to stdout, and nothing else on stdout |
| `eval` | Scores `fixtures/eval.json` and prints one JSON object with the metrics of section 4 |

**Web app (single page, English UI):**
- A textarea prefilled with an example, and generation of the result.
- The DDL output, with a copy button.
- An **ER diagram** (SVG): tables with their columns and FK edges.
- A validation status from really executing the DDL in SQLite (browser WASM or server,
  your choice), plus the warnings for ignored sentences.
- Works at 375 px wide. Keyboard accessible, with visible focus and labelled controls.
- **Its own visual identity:** palette, typography and wordmark, documented in `DESIGN.md`
  at the repo root.

**`README.md`, result first:**
- The eval number at the top.
- How to run it.
- Architecture in under 10 lines.
- 2–3 tradeoffs.
- What didn't work.

## 4. Metric (what `eval` reports)

For each case in `fixtures/eval.json`, take the DDL that `generate` produces, execute it
and introspect it (`sqlite_master`, `PRAGMA table_info`, `PRAGMA foreign_key_list`).

**Sets compared against the gold (F1 for each):**
- Table names.
- `table.column` pairs, all columns, including `id`.
- `table.column->ref_table` FKs.

**Case score:** 0 if the DDL fails to execute; otherwise the mean of the three F1s.

**Report:** `{ "cases": n, "exec_rate": 0..1, "table_f1": 0..1, "column_f1": 0..1,
"fk_f1": 0..1, "score": 0..100 }`, where `score` is the mean case score × 100.

The grader also runs `generate` against **hidden cases** that use the same grammar. Make
the parser general; don't fit it to the visible fixtures.

## 5. Definition of done

1. `bun install`, `build`, `test`, `typecheck` and `lint` all pass.
2. `bun run eval` prints the JSON object above.
3. `bun run dev` serves the page, and it works with no environment variables.
4. `README.md` and `DESIGN.md` exist as described.
5. Everything is committed to git in this repository.
