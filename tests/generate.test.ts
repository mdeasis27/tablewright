import { describe, expect, test } from "bun:test";
import { generate } from "../src/lib/generate";
import { introspect } from "../src/lib/sqlite/bunSqlite";

async function tablesOf(text: string) {
  const result = await introspect(generate(text).ddl);
  if (!result.ok) throw new Error(result.error);
  return result.tables;
}

describe("DDL conventions", () => {
  test("golden DDL: quoted identifiers, id first, exact FK form", () => {
    const { ddl } = generate("A Book has a title. Each Book belongs to one Author.");
    expect(ddl).toBe(
      [
        'CREATE TABLE "author" (\n  "id" INTEGER PRIMARY KEY\n);',
        'CREATE TABLE "book" (\n  "id" INTEGER PRIMARY KEY,\n  "title" TEXT,\n  "author_id" INTEGER REFERENCES "author"(id)\n);',
      ].join("\n\n") + "\n",
    );
  });

  test("reserved words are quoted and execute", async () => {
    const tables = await tablesOf(
      "A Group has a name. A Group has many Orders. An Order has a total.",
    );
    expect(Object.keys(tables).sort()).toEqual(["group", "order"]);
    expect(tables.order?.fks).toEqual({ group_id: "group" });
  });

  test("empty and warnings-only input yield empty DDL", () => {
    expect(generate("").ddl).toBe("");
    expect(generate("Nothing to see here.").ddl).toBe("");
  });

  test("an attribute named like the FK column is not duplicated", async () => {
    const tables = await tablesOf(
      "A Book has a title and an author id. Each Book belongs to one Author.",
    );
    expect(tables.book?.columns).toEqual(["id", "title", "author_id"]);
    expect(tables.book?.fks).toEqual({ author_id: "author" });
  });
});

describe("relations", () => {
  test("many-to-many join table is named alphabetically with both FKs", async () => {
    const tables = await tablesOf("A Course has a title. Many Students relate to many Courses.");
    expect(Object.keys(tables).sort()).toEqual(["course", "course_student", "student"]);
    expect(tables.course_student?.columns).toEqual(["id", "course_id", "student_id"]);
    expect(tables.course_student?.fks).toEqual({ course_id: "course", student_id: "student" });
  });

  test("reversed duplicate m2m sentences produce one join table", async () => {
    const tables = await tablesOf(
      "Many Tags relate to many Articles. Many Articles relate to many Tags.",
    );
    expect(Object.keys(tables).sort()).toEqual(["article", "article_tag", "tag"]);
  });

  test("self many-to-many uses distinct FK columns", async () => {
    const tables = await tablesOf("A User has a name. Many Users relate to many Users.");
    expect(tables.user_user?.columns).toEqual(["id", "user_id", "related_user_id"]);
  });

  test("a join name colliding with a declared entity merges", async () => {
    const tables = await tablesOf(
      "A Course Student has a grade. A Course has a title. Many Students relate to many Courses.",
    );
    expect(tables.course_student?.columns).toEqual(["id", "grade", "course_id", "student_id"]);
  });

  test("self reference and FK cycles still execute", async () => {
    const self = await tablesOf("A Category has many Categories.");
    expect(self.category?.fks).toEqual({ category_id: "category" });
    const cycle = await tablesOf("Each A belongs to one B. Each B belongs to one A.");
    expect(Object.keys(cycle).sort()).toEqual(["a", "b"]);
  });

  test("referenced tables are emitted first", () => {
    const names = generate(
      "Each Book belongs to one Author. An Author has a name.",
    ).schema.tables.map((t) => t.name);
    expect(names).toEqual(["author", "book"]);
  });
});

describe("generalisation (grammar variants, not fixtures)", () => {
  test("multi-word entities with irregular plurals", async () => {
    const tables = await tablesOf(
      "A Gym Class Session has a start time. A Gym has many Gym Class Sessions. A Gym has a name.",
    );
    expect(tables.gym_class_session?.columns).toEqual(["id", "start_time", "gym_id"]);
  });

  test("sentence order does not matter", async () => {
    const forward = await tablesOf(
      "A Company has many Employees. An Employee has an email. A Company has a name.",
    );
    const backward = await tablesOf(
      "A Company has a name. An Employee has an email. A Company has many Employees.",
    );
    expect(Object.keys(forward).sort()).toEqual(Object.keys(backward).sort());
    expect(forward.employee?.fks).toEqual(backward.employee?.fks);
  });

  test("es plurals fall back correctly when the singular is undeclared", async () => {
    const tables = await tablesOf("A Store has many Boxes. A Store has many Addresses.");
    expect(Object.keys(tables).sort()).toEqual(["address", "box", "store"]);
  });

  test("a table that clashes with SQLite internals is renamed and still executes", async () => {
    const tables = await tablesOf("A Sqlite Table has a name.");
    expect(Object.keys(tables)).toEqual(["t_sqlite_table"]);
  });

  test("column types follow the name heuristic", () => {
    const { ddl } = generate("A Product has a price, a stock, a name and a released year.");
    expect(ddl).toContain('"price" REAL');
    expect(ddl).toContain('"stock" INTEGER');
    expect(ddl).toContain('"name" TEXT');
    expect(ddl).toContain('"released_year" INTEGER');
  });
});
