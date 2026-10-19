import { describe, expect, test } from "bun:test";
import { POST } from "../src/app/api/generate/route";
import { MAX_INPUT_CHARS } from "../src/lib/analysis";
import { introspect as bunIntrospect } from "../src/lib/sqlite/bunSqlite";
import { introspect as sqlJsIntrospect } from "../src/lib/sqlite/sqlJs";

function post(body: string): Promise<Response> {
  return POST(new Request("http://test/api/generate", { method: "POST", body }));
}

describe("POST /api/generate", () => {
  test("returns DDL, schema, warnings and a real SQLite validation", async () => {
    const response = await post(
      JSON.stringify({ text: "A Book has a title. Each Book belongs to one Author. Nonsense." }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.error).toBeNull();
    expect(body.data.ddl).toContain('"author_id" INTEGER REFERENCES "author"(id)');
    expect(body.data.warnings).toHaveLength(1);
    expect(body.data.validation).toMatchObject({ ok: true, tables: 2 });
  });

  test("rejects non-JSON bodies", async () => {
    const response = await post("not json");
    expect(response.status).toBe(400);
    expect((await response.json()).success).toBe(false);
  });

  test("rejects a missing or non-string text", async () => {
    expect((await post("{}")).status).toBe(400);
    expect((await post(JSON.stringify({ text: 5 }))).status).toBe(400);
    expect((await post("null")).status).toBe(400);
  });

  test("rejects oversized input", async () => {
    const response = await post(JSON.stringify({ text: "a".repeat(MAX_INPUT_CHARS + 1) }));
    expect(response.status).toBe(400);
  });

  test("rejects an oversized request body before parsing it", async () => {
    const response = await post(`{"text":"${"a".repeat(MAX_INPUT_CHARS * 7)}"}`);
    expect(response.status).toBe(413);
  });

  test("empty text is valid and produces no tables", async () => {
    const body = await (await post(JSON.stringify({ text: "" }))).json();
    expect(body.data.ddl).toBe("");
  });
});

describe("adapter parity", () => {
  const ddls = [
    'CREATE TABLE "a" ("id" INTEGER PRIMARY KEY);\nCREATE TABLE "b" ("id" INTEGER PRIMARY KEY, "a_id" INTEGER REFERENCES "a"(id));',
    "CREATE TABLE ((",
    "",
  ];
  test.each(ddls)("bun:sqlite and sql.js agree on %p", async (ddl) => {
    const [bun, wasm] = await Promise.all([bunIntrospect(ddl), sqlJsIntrospect(ddl)]);
    expect(bun.ok).toBe(wasm.ok);
    if (bun.ok && wasm.ok) expect(wasm.tables).toEqual(bun.tables);
  });
});
