# Tablewright — plain English to a validated SQLite schema

> Produced with ECC `/plan-prd` from `REQUIREMENTS.md`. Non-interactive run: every
> gate question was answered from `REQUIREMENTS.md`; where it was silent the
> recommended option was chosen and is marked **[Decision]**.
>
> Location note **[Decision]**: `/plan-prd` writes to `.claude/prds/`, but `.claude/`
> is git-ignored in this repo, so the PRD lives in `docs/prd/` to be committed.

## Problem
Developers and students who sketch a data model ("a Book has a title… each Book
belongs to one Author") must hand-translate it into DDL, and only discover typos,
reserved-word collisions (`order`, `group`) or broken foreign keys when the DDL
hits a database. Without a deterministic translator they lose time and get
inconsistent naming (plural tables, unquoted identifiers, ad-hoc FK names).

## Evidence
- Requirement source: `REQUIREMENTS.md` (benchmark brief) and 12 gold cases in
  `fixtures/eval.json` that define the expected output exactly.
- Reserved-word tables appear in the gold set (`order`, `group`, `user`), so
  quoting is a real, observed failure mode.
- User demand beyond the brief: Assumption — needs validation via user research.

## Users
- **Primary**: a developer or student drafting a small relational model who wants
  runnable SQLite DDL and a diagram in seconds, from a browser (incl. phone) or a
  shell/CI step (`generate <file>`).
- **Secondary**: the automated grader, which runs `generate` on hidden cases and
  `eval` on the visible fixtures.
- **Not for**: people who need free-form English understanding, non-SQLite
  dialects, migrations on existing databases, or LLM-backed generation.

## Hypothesis
We believe a **deterministic, rule-based parser for a restricted English grammar,
validated by executing the DDL in real SQLite**, will **produce correct, runnable
schemas** for **people sketching data models**. We'll know we're right when
**`bun run eval` reports score ≥ 99 with exec_rate = 1.0 on the visible fixtures,
and the hidden cases (same grammar) score comparably**.

## Success Metrics
| Metric | Target | How measured |
|---|---|---|
| Eval score (visible) | ≥ 99 (aim 100) | `bun run eval` JSON `score` |
| exec_rate | 1.0 | `bun run eval` |
| table / column / fk F1 | 1.0 each | `bun run eval` |
| Generalisation | grammar variants not in fixtures pass | unit tests for every grammar rule and edge case, written from the spec, not the fixtures |
| DoD gates | all green | `bun install`, `build`, `test`, `typecheck`, `lint` |
| Mobile + a11y | usable at 375 px, keyboard-only flow works | browser check at 375 px; keyboard walk-through; labelled controls |
| Test coverage | ≥ 80 % lines on `src/lib` | `bun test --coverage` |

## Scope
**MVP** — everything in `REQUIREMENTS.md` §1–5:
- The four sentence patterns, attribute lists, plural handling, implicit
  entities, warnings for sentences that match no pattern.
- The exact output conventions of §2 (names, PK, FK form, join tables, quoting,
  top-to-bottom execution with `foreign_keys = ON`).
- CLI `generate <file>` (DDL only on stdout, warnings on stderr) and `eval`
  (one JSON object).
- A single-page web app: prefilled textarea, generate, DDL with copy button,
  SVG ER diagram, real SQLite validation status, warnings; 375 px; keyboard
  accessible; own visual identity in `DESIGN.md`.
- `README.md` with eval number first, run steps, architecture in under 10 lines,
  tradeoffs, what didn't work.

**Out of scope**
- LLMs, API keys, network calls at runtime — forbidden by the brief.
- Other SQL dialects, migrations, constraints beyond PK/FK (NOT NULL, UNIQUE,
  indexes) — not in the grammar.
- Grammar extensions (one-to-one, optional relations, explicit types) — would
  risk diverging from the hidden-case grammar.
- Accounts, persistence, sharing links — not required for the hypothesis.
- Editable or draggable diagrams — a static deterministic layout is enough.

## Delivery Milestones
| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | Walking skeleton | `generate` prints DDL for v01; eval prints JSON; page renders | complete | `docs/plan/slice-plan.md` S0–S1 |
| 2 | Full grammar | all §1 rules incl. plurals, join tables, warnings; eval = 100 | complete | S2–S4 |
| 3 | Validated web experience | web page shows DDL, copy, SQLite validation, warnings | complete | S5 |
| 4 | ER diagram + identity | SVG diagram, 375 px, a11y, `DESIGN.md` applied | complete | S6–S7 |
| 5 | Ship | README with eval number, all DoD gates green, committed | complete | S8 |

## Open Questions
Every question was resolved by the recommended option (no human is available).
The full rationale is in `docs/design/system-design.md` §7, "Decision log".
- [x] Self many-to-many (`Many Users relate to many Users`): two FK columns
      would collide. → `user_id` + `related_user_id`, table `user_user`.
- [x] `has many` followed by a lowercase word: treated as an attribute sentence
      (attribute `many …`)? → No. Only Capitalized words count as an entity; a
      lowercase tail is parsed as an attribute list (e.g. `has many notes` →
      column `many_notes`), as the grammar dictates.
- [x] Final sentence without a trailing `.` → accepted as a sentence.
- [x] Where SQLite runs for the web → on the server (Next.js route handler,
      sql.js WASM). The server regenerates the DDL from the text, so it never
      executes client-supplied SQL.
- [ ] Hidden-case coverage of grammar corners we haven't foreseen.
      TBD — needs validation via the grader. Mitigation: spec-driven tests.

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Parser overfits the visible fixtures | Med | High (hidden score) | Tests derived from each §1 rule, plus generated variants (order shuffles, Oxford comma, `the` articles, multi-word entities, `-ies`/`-ches`/`-xes` plurals) |
| Plural singularisation picks the wrong candidate | Med | High | Implement the §1 preference rule exactly; table-driven tests |
| Two SQLite engines (bun:sqlite in the CLI, sql.js on the web) disagree | Low | Med | One shared introspection interface; parity test over all fixtures |
| Next.js bundling breaks sql.js WASM loading | Med | Med | `serverExternalPackages: ["sql.js"]`; checked by build plus a route test |
| `generate` leaks non-DDL text onto stdout | Low | High | Integration test spawns the CLI and compares stdout byte for byte |
| Web fonts need the network at build time | Med | Med | Self-hosted Fontsource packages, no `next/font/google` |

---
*Status: APPROVED (auto-approved, non-interactive run). Implementation plan: `docs/plan/slice-plan.md`.*
