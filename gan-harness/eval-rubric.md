# GAN evaluator rubric — Tablewright

Each axis is scored 0–10. The iteration score is the weighted mean, the pass
threshold is **7.0**, and any **hard constraint** violation in `spec.md` caps
the score at 3.

| Axis | Weight | 10 looks like | How to check |
|---|---|---|---|
| Correctness vs spec | 0.35 | `bun run eval` score 100 / exec_rate 1; the generalisation suite is green; behaviour matches system-design §2–§3 exactly | run eval + `bun test`; spot-check 3 unseen grammar variants by hand |
| Code quality | 0.15 | pure `src/lib`, small functions, immutable IR, no dead code, clear names | read the diff; `bun run lint`; `bun run typecheck` |
| Tests | 0.15 | tests written from the spec; ≥ 80 % coverage on `src/lib`; CLI stdout byte-exact test | `bun test --coverage` |
| UI function (S5+) | 0.15 | Generate, Copy, status and warnings all work; the diagram shows every table, column and FK edge | browser walk-through |
| Accessibility & responsive (S5+) | 0.10 | works at 375 px with no clipped controls; full keyboard flow; visible focus; labels; contrast per DESIGN.md | resize to 375; Tab through; Lighthouse a11y ≥ 95 |
| Visual identity (S7) | 0.10 | the DESIGN.md palette, fonts, wordmark and diagram styling are applied consistently | screenshot review against DESIGN.md |

For code-only slices (S1–S4), the UI, accessibility and identity axes are
re-weighted onto correctness (0.6), quality (0.2) and tests (0.2).

The feedback file (`gan-harness/feedback/feedback-NNN.md`) must list each
failing check with the exact command or step that shows it.
