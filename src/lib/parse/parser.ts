import type { Model, Relation, Warning } from "../types";
import { singularTable, tableName } from "./names";
import { type Matched, matchSentence } from "./patterns";
import { splitSentences } from "./sentences";

type Parsed = { readonly index: number; readonly sentence: string; readonly match: Matched };

/** Table names of every entity written in singular form (pass 1). */
function knownSingulars(parsed: readonly Parsed[]): Set<string> {
  const known = new Set<string>();
  for (const { match } of parsed) {
    if (match.kind === "hasMany") known.add(tableName(match.owner));
    if (match.kind === "belongsTo") {
      known.add(tableName(match.child));
      known.add(tableName(match.owner));
    }
    if (match.kind === "entity" || match.kind === "emptyEntity") {
      known.add(tableName(match.entity));
    }
  }
  return known;
}

function relationsOf(match: Matched, known: ReadonlySet<string>): Relation[] {
  switch (match.kind) {
    case "hasMany":
      return [
        {
          kind: "fk",
          from: singularTable(match.pluralChild, known),
          to: tableName(match.owner),
        },
      ];
    case "belongsTo":
      return [{ kind: "fk", from: tableName(match.child), to: tableName(match.owner) }];
    case "relate":
      return [
        {
          kind: "m2m",
          a: singularTable(match.pluralA, known),
          b: singularTable(match.pluralB, known),
        },
      ];
    default:
      return [];
  }
}

function tablesOf(relation: Relation): string[] {
  return relation.kind === "fk" ? [relation.from, relation.to] : [relation.a, relation.b];
}

function relationKey(relation: Relation): string {
  return relation.kind === "fk"
    ? `fk:${relation.from}>${relation.to}`
    : `m2m:${[relation.a, relation.b].sort().join("|")}`;
}

function dedupe(relations: readonly Relation[]): Relation[] {
  const seen = new Set<string>();
  return relations.filter((relation) => {
    const key = relationKey(relation);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parse(text: string): Model {
  const parsed: Parsed[] = splitSentences(text).map((sentence, index) => ({
    index: index + 1,
    sentence,
    match: matchSentence(sentence),
  }));
  const known = knownSingulars(parsed);

  const order: string[] = [];
  const attributes = new Map<string, readonly string[]>();
  const relations: Relation[] = [];
  const warnings: Warning[] = [];
  const touch = (table: string): void => {
    if (!order.includes(table)) order.push(table);
  };

  for (const { index, sentence, match } of parsed) {
    if (match.kind === "none" || match.kind === "emptyEntity") {
      const reason = match.kind === "none" ? "no pattern matched" : "no attributes found";
      warnings.push({ sentence, index, reason });
    }
    if (match.kind === "entity" || match.kind === "emptyEntity") {
      const table = tableName(match.entity);
      touch(table);
      if (match.kind === "entity") {
        const merged = [...new Set([...(attributes.get(table) ?? []), ...match.attributes])];
        attributes.set(table, merged);
      }
    }
    for (const relation of relationsOf(match, known)) {
      relations.push(relation);
      for (const table of tablesOf(relation)) touch(table);
    }
  }
  return { order, attributes, relations: dedupe(relations), warnings };
}
