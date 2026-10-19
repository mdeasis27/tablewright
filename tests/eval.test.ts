import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseFixtures } from "../src/lib/eval/fixtures";
import { aggregate, f1, scoreCase } from "../src/lib/eval/metrics";
import { runEval } from "../src/lib/eval/run";
import { introspect } from "../src/lib/sqlite/bunSqlite";

const FIXTURES = resolve(import.meta.dir, "../fixtures/eval.json");

describe("f1", () => {
  test("both empty is a perfect score", () => {
    expect(f1(new Set(), new Set())).toBe(1);
  });
  test("disjoint sets score zero", () => {
    expect(f1(new Set(["a"]), new Set(["b"]))).toBe(0);
  });
  test("partial overlap uses precision and recall", () => {
    expect(f1(new Set(["a", "b"]), new Set(["a", "c"]))).toBeCloseTo(0.5);
  });
});

describe("scoreCase", () => {
  test("a DDL that fails to execute scores zero", async () => {
    const result = await introspect("CREATE TABLE ((");
    expect(result.ok).toBe(false);
    const score = scoreCase(result, { a: { columns: ["id"], fks: {} } });
    expect(score).toMatchObject({ executed: false, score: 0 });
  });

  test("aggregate reports the documented keys", () => {
    const report = aggregate([
      { executed: true, tableF1: 1, columnF1: 1, fkF1: 1, score: 1 },
      { executed: false, tableF1: 0, columnF1: 0, fkF1: 0, score: 0 },
    ]);
    expect(Object.keys(report)).toEqual([
      "cases",
      "exec_rate",
      "table_f1",
      "column_f1",
      "fk_f1",
      "score",
    ]);
    expect(report).toMatchObject({ cases: 2, exec_rate: 0.5, score: 50 });
  });
});

describe("fixtures", () => {
  test("rejects malformed fixture files", () => {
    expect(() => parseFixtures({})).toThrow();
    expect(() => parseFixtures([{ text: 1 }])).toThrow();
  });

  test("the visible fixtures score a perfect 100", async () => {
    const cases = parseFixtures(JSON.parse(readFileSync(FIXTURES, "utf8")));
    const { report } = await runEval(cases, introspect);
    expect(report).toEqual({
      cases: 12,
      exec_rate: 1,
      table_f1: 1,
      column_f1: 1,
      fk_f1: 1,
      score: 100,
    });
  });

  test("sentence order shuffles keep every fixture perfect", async () => {
    const cases = parseFixtures(JSON.parse(readFileSync(FIXTURES, "utf8")));
    const shuffled = cases.map((c) => ({
      ...c,
      text: c.text
        .split(". ")
        .reverse()
        .map((s) => s.replace(/\.$/, ""))
        .join(". "),
    }));
    const { report } = await runEval(shuffled, introspect);
    expect(report.score).toBe(100);
  });
});
