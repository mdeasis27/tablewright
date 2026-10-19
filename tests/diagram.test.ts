import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { layoutDiagram } from "../src/lib/diagram/layout";
import { parseFixtures } from "../src/lib/eval/fixtures";
import { generate } from "../src/lib/generate";

function overlaps(a: { x: number; y: number; width: number; height: number }, b: typeof a) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

describe("layoutDiagram", () => {
  test("an empty schema has no boxes or edges", () => {
    expect(layoutDiagram({ tables: [] })).toEqual({ width: 0, height: 0, boxes: [], edges: [] });
  });

  test("referenced tables sit left of the tables that reference them", () => {
    const { boxes } = layoutDiagram(generate("Each Book belongs to one Author.").schema);
    const x = (name: string) => boxes.find((b) => b.table === name)?.x ?? Number.NaN;
    expect(x("author")).toBeLessThan(x("book"));
  });

  test("one edge per foreign key, ending at the referenced id row", () => {
    const { schema } = generate("Many Students relate to many Courses. A Course has a title.");
    const diagram = layoutDiagram(schema);
    const fkCount = schema.tables.flatMap((t) => t.columns).filter((c) => c.references).length;
    expect(diagram.edges).toHaveLength(fkCount);
    expect(diagram.edges.every((edge) => edge.path.startsWith("M "))).toBe(true);
  });

  test("is deterministic", () => {
    const { schema } = generate("A Customer has many Orders. An Order has a total.");
    expect(layoutDiagram(schema)).toEqual(layoutDiagram(schema));
  });

  test("handles self references and cycles", () => {
    const self = layoutDiagram(generate("A Category has many Categories.").schema);
    expect(self.edges).toHaveLength(1);
    const cycle = layoutDiagram(
      generate("Each A belongs to one B. Each B belongs to one A.").schema,
    );
    expect(cycle.boxes).toHaveLength(2);
    expect(cycle.edges).toHaveLength(2);
  });

  test("no two boxes overlap for any fixture", () => {
    const cases = parseFixtures(
      JSON.parse(readFileSync(resolve(import.meta.dir, "../fixtures/eval.json"), "utf8")),
    );
    for (const testCase of cases) {
      const { boxes } = layoutDiagram(generate(testCase.text).schema);
      for (const [i, a] of boxes.entries()) {
        for (const b of boxes.slice(i + 1)) expect(overlaps(a, b)).toBe(false);
      }
    }
  });
});
