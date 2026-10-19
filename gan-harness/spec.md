# GAN harness spec — Tablewright

Written by `/orch-build-mvp` in place of `gan-planner` output (`--skip-planner`).
Source of truth: `REQUIREMENTS.md` → `docs/design/system-design.md` →
`docs/plan/slice-plan.md`. Do not restate those documents here; follow them.

## Brief
Tablewright turns restricted English ("A Book has a title. Each Book belongs to one
Author.") into quoted SQLite DDL. It validates the DDL by executing it in real
SQLite and draws an SVG ER diagram. It ships as a Bun + Next.js App Router app
plus two CLIs: `generate <file>` and `eval`.

## Per-slice briefs for `/gan-build "<brief>" --skip-planner`
| Slice | Brief | Eval mode |
|---|---|---|
| S1 | "Walking skeleton: P4 attribute sentences → DDL → bun:sqlite introspection; generate + eval CLIs" | code-only |
| S2 | "belongs-to and has-many with exact §2.6 singularisation, two-pass resolution, implicit tables, topo order" | code-only |
| S3 | "many-to-many join tables, alphabetical names, self-relation rule D1; eval reaches 100" | code-only |
| S4 | "warnings for unmatched sentences on stderr/UI; robustness + generalisation suite; coverage ≥ 80%" | code-only |
| S5 | "Web page: prefilled textarea, Generate, DDL + Copy, sql.js validation via /api/generate, warnings" | playwright |
| S6 | "SVG ER diagram from pure layoutDiagram(schema): boxes, columns, FK edges, accessible text" | playwright |
| S7 | "Apply DESIGN.md identity; 375 px layout; keyboard + focus-visible; labelled controls" | playwright |

## Hard constraints (an evaluator must fail the iteration on any violation)
- `bun run generate <file>` writes the DDL only to stdout (warnings → stderr).
- `bun run eval` prints exactly one JSON object with the keys `cases, exec_rate,
  table_f1, column_f1, fk_f1, score`.
- No `any`, no `@ts-ignore`, TypeScript strict. `bun test`, `typecheck`, `lint`
  and `build` are all green.
- No LLM, no network calls, no env vars required.
