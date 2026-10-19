import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseFixtures } from "../lib/eval/fixtures";
import { runEval } from "../lib/eval/run";
import { introspect } from "../lib/sqlite/bunSqlite";

const DEFAULT_FIXTURES = resolve(import.meta.dir, "../../fixtures/eval.json");

async function main(argv: readonly string[]): Promise<number> {
  const path = argv[0] ? resolve(argv[0]) : DEFAULT_FIXTURES;
  try {
    const cases = parseFixtures(JSON.parse(readFileSync(path, "utf8")));
    const { report } = await runEval(cases, introspect);
    process.stdout.write(`${JSON.stringify(report)}\n`);
    return 0;
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    process.stderr.write(`eval failed: ${reason}\n`);
    return 1;
  }
}

process.exitCode = await main(process.argv.slice(2));
