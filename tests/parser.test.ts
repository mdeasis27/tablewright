import { describe, expect, test } from "bun:test";
import { parseAttributes } from "../src/lib/parse/attributes";
import { singularTable, tableName } from "../src/lib/parse/names";
import { parse } from "../src/lib/parse/parser";
import { splitSentences } from "../src/lib/parse/sentences";

describe("splitSentences", () => {
  test("splits on periods and collapses whitespace and newlines", () => {
    expect(splitSentences("A Book has a title.\n  An Author   has a name.")).toEqual([
      "A Book has a title",
      "An Author has a name",
    ]);
  });

  test("accepts a final sentence without a period", () => {
    expect(splitSentences("A Book has a title. An Author has a name")).toHaveLength(2);
  });

  test("returns nothing for empty input", () => {
    expect(splitSentences("  \n ")).toEqual([]);
  });
});

describe("parseAttributes", () => {
  test.each([
    ["a title, an isbn and a published year", ["title", "isbn", "published_year"]],
    ["a first name, a last name, and an email", ["first_name", "last_name", "email"]],
    ["the name and the age", ["name", "age"]],
    ["title", ["title"]],
    ["a title, a title and a body", ["title", "body"]],
    ["an id and a name", ["name"]],
  ])("%s", (input, expected) => {
    expect(parseAttributes(input)).toEqual(expected);
  });
});

describe("tableName", () => {
  test("snake_cases multi-word entities", () => {
    expect(tableName("Line Item")).toBe("line_item");
    expect(tableName("Gym Class Session")).toBe("gym_class_session");
  });

  test("does not split CamelCase humps", () => {
    expect(tableName("LineItem")).toBe("lineitem");
  });

  test("avoids the reserved sqlite_ prefix", () => {
    expect(tableName("Sqlite Thing")).toBe("t_sqlite_thing");
  });
});

describe("singularTable (pinned literal rule)", () => {
  test.each([
    ["Boxes", [], "box"],
    ["Categories", [], "category"],
    ["Courses", [], "cours"],
    ["Courses", ["course"], "course"],
    ["Horses", [], "hors"],
    ["Houses", [], "hous"],
    ["Purchases", [], "purchas"],
    ["Movies", [], "movy"],
    ["Movies", ["movie"], "movie"],
    ["Heroes", [], "heroe"],
    ["Heroes", ["hero"], "hero"],
    ["Quizzes", ["quiz"], "quizz"],
    ["Statuses", [], "status"],
    ["Buses", ["bus"], "bus"],
    ["Line Items", [], "line_item"],
    ["Employees", [], "employee"],
    ["Matches", [], "match"],
    ["Wishes", [], "wish"],
    ["Taxes", [], "tax"],
    ["Staff", [], "staff"],
    ["DVDs", [], "dvd"],
  ])("%s with %j -> %s", (plural, known, expected) => {
    expect(singularTable(plural, new Set(known))).toBe(expected);
  });
});

describe("parse", () => {
  test("entity with attributes", () => {
    const model = parse("A Book has a title and an isbn.");
    expect(model.order).toEqual(["book"]);
    expect(model.attributes.get("book")).toEqual(["title", "isbn"]);
    expect(model.warnings).toEqual([]);
  });

  test("has many resolves the plural to a declared singular regardless of order", () => {
    const model = parse("A Customer has many Orders. An Order has a total.");
    expect(model.relations).toEqual([{ kind: "fk", from: "order", to: "customer" }]);
    const reversed = parse("An Order has a total. A Customer has many Orders.");
    expect(reversed.relations).toEqual(model.relations);
  });

  test("an entity mentioned only in a relation becomes a table", () => {
    expect(parse("Each Order belongs to one Customer.").order).toEqual(["order", "customer"]);
  });

  test("duplicate FK descriptions collapse to one relation", () => {
    const model = parse(
      "A Customer has many Orders. Each Order belongs to one Customer. An Order has a total.",
    );
    expect(model.relations).toHaveLength(1);
  });

  test("reversed many-to-many sentences collapse to one relation", () => {
    const model = parse("Many Tags relate to many Articles. Many Articles relate to many Tags.");
    expect(model.relations).toHaveLength(1);
  });

  test("unmatched sentences become warnings with their index", () => {
    const model = parse("A Book has a title. The sky is blue. Books are nice.");
    expect(model.warnings.map((w) => [w.index, w.sentence])).toEqual([
      [2, "The sky is blue"],
      [3, "Books are nice"],
    ]);
  });

  test("lowercase word after has many is an attribute list, not an entity", () => {
    const model = parse("A Book has many pages.");
    expect(model.attributes.get("book")).toEqual(["many_pages"]);
    expect(model.relations).toEqual([]);
  });

  test("an empty attribute list still declares the entity and warns", () => {
    const model = parse("A Tag has an id.");
    expect(model.order).toEqual(["tag"]);
    expect(model.warnings).toHaveLength(1);
  });

  test("keywords are case-insensitive but entities must be capitalized", () => {
    expect(parse("a Book HAS a title.").attributes.get("book")).toEqual(["title"]);
    expect(parse("A book has a title.").warnings).toHaveLength(1);
  });

  test("a 20k-character adversarial input parses quickly", () => {
    const started = performance.now();
    parse(`A ${"Word ".repeat(4000)}has ${"a b, ".repeat(2000)}.`);
    parse("A Aa ".repeat(4000));
    expect(performance.now() - started).toBeLessThan(500);
  });
});
