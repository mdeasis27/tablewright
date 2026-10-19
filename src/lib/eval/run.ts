import { generate } from "../generate";
import type { ExecResult } from "../sqlite/introspect";
import { aggregate, type CaseScore, type EvalCase, type EvalReport, scoreCase } from "./metrics";

export type Introspector = (ddl: string) => Promise<ExecResult>;

export async function runEval(
  cases: readonly EvalCase[],
  introspect: Introspector,
): Promise<{ report: EvalReport; scores: readonly CaseScore[] }> {
  const scores: CaseScore[] = [];
  for (const testCase of cases) {
    const { ddl } = generate(testCase.text);
    scores.push(scoreCase(await introspect(ddl), testCase.gold));
  }
  return { report: aggregate(scores), scores };
}
