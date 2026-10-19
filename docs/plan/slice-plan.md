# Tablewright — MVP Slice Plan (`/orch-build-mvp`, Gate 1)

Spec inputs: `REQUIREMENTS.md` · `docs/prd/tablewright.prd.md` ·
`docs/design/system-design.md` (parser spec + decision log D1–D23) · `DESIGN.md`.

**Size tier:** large (new project, external deps, public CLI contract, spec doc),
so the pipeline runs phases 0 → 1 → 2 → 3 (scaffold) → 4 → 5 → 6.
**Gate 1 (this plan):** auto-approved (non-interactive run).
**Gate 2 (per-slice commit):** auto-confirmed once the slice's exit checks are green.

## Working rules for every slice
- **TDD** (`tdd-guide` / `tdd-workflow`): write the failing `bun test` first,
  then green, then refactor. Tests are derived from the spec section listed for
  the slice, never from fixture output alone.
- **Exit checks** (all must pass before the commit): `bun test`,
  `bun run typecheck`, `bun run lint`. Slices from S1 on also run
  `bun run eval`. Slices from S5 on also run `bun run build`.
- **Review** after each slice: `code-reviewer` + `typescript-reviewer`;
  `react-reviewer` on `.tsx` slices; `security-reviewer` on S5 (user input +
  route handler). CRITICAL and HIGH findings are fixed before the commit.
- **Commit:** one conventional commit per slice (`feat:` / `test:` / `docs:` /
  `chore:`), ending with the Co-Authored-By trailer.
- **Code limits:** functions under 50 lines, files under 400 lines, no `any`,
  no `@ts-ignore`, no `console.log` in `src/lib`, immutable data.
- **Inner loop:** `/gan-build "<brief>" --skip-planner` with
  `gan-harness/spec.md` + `gan-harness/eval-rubric.md`. Use `--eval-mode
  code-only` for S1–S4 and `playwright` (or Chrome DevTools MCP when
  Playwright browsers are missing) for S5–S7. Pass threshold 7.0, at most 15
  iterations.

## Slices (thin vertical first, then widen)

### S0 — Scaffold (`chore:`)
- `package.json` (Bun) with these scripts:
  - `dev`=`next dev`, `build`=`next build`, `start`=`next start`
  - `test`=`bun test`, `typecheck`=`tsc --noEmit`, `lint`=`biome check .`
  - `generate`=`bun src/cli/generate.ts`, `eval`=`bun src/cli/eval.ts`
- Dependencies pinned per D15. Add `@types/sql.js` and `@types/bun`.
- `tsconfig.json`: strict, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, paths `@/*` → `src/*`. Leave `types` unset
  (D20).
- `biome.json`: recommended rules, `noExplicitAny` = error, `noTsIgnore` = error;
  `files.includes` per D18 (never reformat `fixtures/`).
- `next.config.ts`: `serverExternalPackages: ["sql.js"]`. `sql.js` goes in
  `dependencies`.
- Minimal `src/app/layout.tsx` + `page.tsx` ("Tablewright").
- `.gitignore`: add `coverage/`, `*.tsbuildinfo`. Commit `next-env.d.ts` (D21)
  and `bun.lock`.
- Verify D19: `bun run dev` / `bun run build` start Next on this host.
- **Exit:** `bun install`, `typecheck`, `lint`, `build` green; one trivial test
  passes.

### S1 — Walking skeleton: one entity, end to end (`feat:`)
Spec: system-design §2.1, §2.3 P4, §2.4, §3.1, §3.4, §4, §5.
- `parse` handles only P4 for now; `buildSchema`; `emitDdl` with quoting.
- `SqlEngine` port + `bunSqlite` adapter (`introspect`).
- `src/lib/eval`: set builders, `f1`, case score, aggregate report.
- `src/cli/generate.ts`: reads the file and prints the DDL to stdout and the
  warnings to stderr. Missing file → stderr + exit code 2.
- `src/cli/eval.ts`: prints the JSON object.
- Tests:
  - Attribute-list variants: Oxford comma, `the`/`a`/`an`, multi-word
    attributes, two-item lists.
  - Quoting of reserved words (`order`, `group`).
  - The DDL executes with `foreign_keys = ON`.
  - F1 edge cases (both empty → 1, disjoint → 0).
  - CLI integration: spawn `bun run generate <tmp>`; stdout equals
    `generate(text).ddl` exactly; warnings appear only on stderr.
    Warnings-only input → empty stdout and exit code 0. A relative path
    resolves from the caller's working directory.
  - Golden DDL string: pins `INTEGER REFERENCES "author"(id)` and the
    quoting.
- **Exit:** eval prints valid JSON with all six keys (the score is partial).

### S2 — Relations: belongs-to and has-many (`feat:`)
Spec: §2.3 P1/P2, §2.5, §2.6, §2.7, §3.1.
- Two-pass resolution, known-singular collection, singularisation exactly as
  §2.6.
- Implicit tables (an entity seen only in a relation gets just `id`).
- Topological emit order; cycle fallback.
- Tests:
  - Table-driven singularisation pinned to the literal outputs in
    system-design §2.6 (`cours`, `hors`, `movy`, `heroe`, `quizz` when
    undeclared). Also: preference for a declared singular (`Bus` vs `Buses`),
    and multi-word entities (`Line Items`).
  - FK dedupe after singularisation: `has many` + `belongs to` describing the
    same FK give one column. Self-edge `Category has many Categories`.
  - An empty P4 (`A Tag has an id.`) still produces the table; the
    `sqlite_` prefix is guarded.
  - Sentence order independence: shuffle each fixture's sentences, expect the
    same table/column/FK sets.
  - Duplicate FK dedupe; attribute named like an FK column (`author_id`).
  - FK cycles (`A` belongs to `B`, `B` belongs to `A`) still execute.
- **Exit:** v01, v02, v04–v08, v10, v12 score 1.0.

### S3 — Many-to-many join tables (`feat:`)
Spec: §2.3 P3, §3.2.
- Tests:
  - Alphabetical naming (`course_student`, `article_tag`, `group_user`).
  - Self relation (D1).
  - Reversed duplicate m2m sentences produce one join table.
  - A join name colliding with a declared entity merges.
  - Implicit endpoints.
- **Exit:** `bun run eval` → score 100, exec_rate 1.

### S4 — Warnings and hardening (`feat:`)
Spec: §2.1, §2.3 warnings, §8.
- Every unmatched sentence produces a `Warning`. The CLI prints them to stderr
  as `warning: ignored sentence N: "<text>"`.
- Robustness tests:
  - Whitespace and newlines; a missing final period (D3).
  - Lowercase `has many` (D2); CamelCase/acronym entities (D5: `DVDs` → `dvd`).
  - Empty input → empty stdout, exit code 0.
  - A 20 000-char adversarial string parses in under 200 ms.
- A **generalisation suite**: about 15 hand-written cases built from the
  grammar (`Gym Class Session`, `Addresses`, `Matches`, `Wishes`, `Companies`,
  `Taxes`, `Quizzes`, a reserved-word table `Match`, attributes containing
  digits). These are kept separate from `fixtures/eval.json`.
- Coverage of `src/lib` ≥ 80 % (`bun test --coverage`).
- **Exit:** all suites green; eval is still 100.

### S5 — Web: generate, DDL, copy, validation, warnings (`feat:`)
Spec: §4 (sql.js adapter), §6 API and UI regions.
- `sqlJs` adapter + parity test against `bunSqlite` over all fixtures and one
  malformed DDL.
- `POST /api/generate` route: input validation, the envelope, a 400 on bad
  input. Its tests call the exported `POST` with `Request` objects. The route
  sets `runtime = "nodejs"` and the page sets `dynamic = "force-dynamic"`.
- An import-isolation test: no `bun:sqlite` import is reachable from
  `src/app`. `bun run build` is the smoke check.
- `Workbench` client component: the textarea prefilled with the example
  (v06-style blog model plus one many-to-many), Generate (button +
  Ctrl/Cmd+Enter), the DDL panel with Copy, the validation badge and the
  warnings list. The first result is server-rendered.
- `security-reviewer` runs on this slice.
- **Exit:** `build` green; browser check that typing, Generate, the badge and
  Copy all work.

### S6 — ER diagram (`feat:`)
Spec: §6 ER diagram.
- `layoutDiagram(schema)`: a pure function, unit-tested (layer assignment, no
  overlapping boxes, one edge per FK, deterministic output).
- `ErDiagram` SVG component: title/desc, a hidden relationship list, a
  scrollable focusable region, and the Fit toggle.
- **Exit:** the diagram renders for every fixture without overlaps, both on
  the dev server and through a layout snapshot test.

### S7 — Visual identity, responsive, accessibility (`feat:`)
Spec: `DESIGN.md`, §6 A11y.
- Apply the palette tokens as CSS custom properties, the Fontsource fonts and
  the wordmark SVG.
- Two-column layout at ≥ 768 px; check the result at 375 px.
- Keyboard walk-through: Tab order, focus ring, Ctrl+Enter, the Copy
  announcement.
- Optional Playwright smoke test `e2e/smoke.e2e.ts` (D12).
- **Exit:** a Chrome DevTools MCP check at 375 px and 1280 px (screenshots in
  `docs/screenshots/`); Lighthouse accessibility ≥ 95.

### S8 — Ship docs (`docs:`)
- `README.md`, result first:
  - The eval number from `bun run eval`.
  - How to run it.
  - The architecture in at most 9 lines.
  - Tradeoffs: rule-based vs NLP; server-side sql.js vs browser WASM; two
    engines with a parity test.
  - What didn't work, filled in honestly from build notes.
- Final DoD run from a fresh state (`rm -rf node_modules .next`): `bun install
  && bun run build && bun test && bun run typecheck && bun run lint && bun run
  eval`; then `bun run dev` with no env vars.
- Update the PRD milestone statuses to `complete`. Commit the README, the
  screenshots and the status updates in a final commit after the DoD run, and
  make sure `git status` is clean.

## Dependency graph
S0 → S1 → S2 → S3 → S4 → S5 → S6 → S7 → S8. S6's pure layout work may start
in parallel with S5, since it depends only on the `Schema` type from S1.

## Definition of done (REQUIREMENTS §5) → slice mapping
| DoD item | Covered by |
|---|---|
| install/build/test/typecheck/lint pass | S0 onward (exit checks), final run in S8 |
| `bun run eval` prints the JSON | S1 (shape), S3 (score 100) |
| `bun run dev` works with no env vars | S5, re-checked in S8 |
| README.md + DESIGN.md | DESIGN.md (planning phase), README in S8 |
| Everything committed | per-slice commits |
