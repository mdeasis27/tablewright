# Tablewright

**Eval score: 100 / 100** on `fixtures/eval.json`. This is the output of `bun run eval`:

```json
{"cases":12,"exec_rate":1,"table_f1":1,"column_f1":1,"fk_f1":1,"score":100}
```

Plain English in, validated SQLite out. Describe a data model in restricted English and
Tablewright generates quoted SQLite DDL, executes it in a real SQLite engine to validate it,
and draws an ER diagram. Generation is deterministic and rule-based: no LLM and no API keys.

```text
A Book has a title, an isbn and a published year. Each Book belongs to one Author.
```

## Run it

Requires [Bun](https://bun.sh) and Node 20.9 or newer (Next.js runs on Node). No environment variables are needed.

```sh
bun install
bun run dev                    # web app on http://localhost:3000 (use -p or PORT to change)
bun run generate model.txt     # DDL on stdout, warnings on stderr
bun run eval                   # one JSON object with the metrics
bun run build && bun test && bun run typecheck && bun run lint
```

## Architecture

1. `src/lib/parse/` splits sentences, matches four patterns (case-sensitive entities), and resolves plurals in two passes.
2. `src/lib/schema/` turns the model into tables, columns, join tables and a topological emit order.
3. `src/lib/ddl/` renders every identifier double-quoted; `generate()` in `src/lib/generate.ts` ties 1–3 together and is pure.
4. `src/lib/sqlite/` has one introspection routine (`sqlite_master`, `table_info`, `foreign_key_list`) behind two adapters:
   `bun:sqlite` (CLI, eval, tests) and `sql.js` WASM (Next.js server).
5. `src/lib/eval/` computes the set F1s against `fixtures/eval.json`; `src/cli/` holds the thin `generate` and `eval` entry points.
6. `src/app/api/generate/route.ts` regenerates DDL from the text on the server and validates it, so the server never executes client-supplied SQL.
7. `src/components/` has the workbench UI and the SVG ER diagram, laid out by the pure `src/lib/diagram/layout.ts`.
8. Specs: `docs/prd/`, `docs/design/system-design.md` (normative parser spec and decision log), `docs/plan/slice-plan.md`, `DESIGN.md`.

## Tradeoffs

- **Rules over NLP.** The grammar is four sentence shapes, so anchored regexes are exact, linear-time and testable. Anything outside the grammar becomes a warning rather than a guess.
- **Validation on the server (sql.js), not in the browser.** It avoids shipping a WASM asset pipeline to the client and keeps the page working with no setup. The cost is a network round trip on each generate. Two engines mean two code paths, so a parity test runs both adapters over the same DDL.
- **The §1 singularisation rule is implemented literally.** An undeclared `Courses` becomes `cours` (it ends in `ses`), and `Quizzes` becomes `quizz`. Declaring the singular elsewhere (`A Course has…`) fixes it. This follows the written rule rather than "improving" it, because the gold output is built from that rule.

## What didn't work

- **CamelCase hump splitting.** The first design split `LineItem` into `line_item`. Review showed that it would turn acronym plurals like `DVDs` into `dv_ds`, and the grammar defines entities as space-separated Capitalized words anyway, so it was removed.
- **Blank DDL.** `bun:sqlite` throws on an empty SQL string where `sql.js` accepts it. The parity test caught this, and introspection now skips execution for blank DDL.
- **My own tests assumed friendlier plurals.** I first wrote tests that expected an undeclared `Courses` to give `course`; the literal rule says `cours`, so the tests were wrong, not the parser.
- **Browser window resizing.** The DevTools window would not go below about 500 px, so the 375 px check uses device emulation instead.
- **Not exercised:** a physical phone and non-Chromium browsers. Lighthouse (mobile) gave 100 for accessibility, and there is no horizontal page overflow at 375 px; screenshots are in `docs/screenshots/`.
