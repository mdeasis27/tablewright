import { safeName } from "../parse/names";
import type { Column, ColumnType, Model, Relation, Schema, Table } from "../types";

const INTEGER_WORDS = new Set([
  "year",
  "quantity",
  "stock",
  "credits",
  "age",
  "count",
  "rank",
  "position",
  "number",
]);
const REAL_WORDS = new Set([
  "price",
  "amount",
  "total",
  "budget",
  "weight",
  "cost",
  "salary",
  "balance",
  "rate",
]);

export function columnType(name: string): ColumnType {
  const last = name.split("_").pop() ?? name;
  if (INTEGER_WORDS.has(last)) return "INTEGER";
  if (REAL_WORDS.has(last)) return "REAL";
  return "TEXT";
}

const ID_COLUMN: Column = { name: "id", type: "INTEGER", primaryKey: true };

type Draft = { readonly name: string; readonly isJoin: boolean; readonly columns: Column[] };

function foreignKey(column: string, references: string): Column {
  return { name: column, type: "INTEGER", references };
}

/** Add a FK column, upgrading an existing same-named column instead of duplicating it. */
function addForeignKey(draft: Draft, column: string, references: string): void {
  const at = draft.columns.findIndex((existing) => existing.name === column);
  if (at >= 0) draft.columns[at] = foreignKey(column, references);
  else draft.columns.push(foreignKey(column, references));
}

function joinColumns(a: string, b: string): { name: string; to: string }[] {
  if (a === b) {
    return [
      { name: `${a}_id`, to: a },
      { name: `related_${a}_id`, to: a },
    ];
  }
  return [
    { name: `${a}_id`, to: a },
    { name: `${b}_id`, to: b },
  ];
}

function joinTableName(a: string, b: string): { name: string; a: string; b: string } {
  const [first = a, second = b] = [a, b].sort();
  return { name: safeName(`${first}_${second}`), a: first, b: second };
}

function ensure(drafts: Map<string, Draft>, name: string, isJoin: boolean): Draft {
  const existing = drafts.get(name);
  if (existing) return existing;
  const created: Draft = { name, isJoin, columns: [ID_COLUMN] };
  drafts.set(name, created);
  return created;
}

function applyRelation(drafts: Map<string, Draft>, relation: Relation): void {
  if (relation.kind === "fk") {
    addForeignKey(ensure(drafts, relation.from, false), `${relation.to}_id`, relation.to);
    ensure(drafts, relation.to, false);
    return;
  }
  ensure(drafts, relation.a, false);
  ensure(drafts, relation.b, false);
  const join = joinTableName(relation.a, relation.b);
  const draft = ensure(drafts, join.name, true);
  for (const column of joinColumns(join.a, join.b)) addForeignKey(draft, column.name, column.to);
}

/** Order tables so referenced tables come first; self-edges are ignored, cycles fall back. */
function topologicalOrder(tables: readonly Table[]): Table[] {
  const remaining = [...tables];
  const emitted = new Set<string>();
  const result: Table[] = [];
  const ready = (table: Table): boolean =>
    table.columns.every(
      (column) =>
        !column.references || column.references === table.name || emitted.has(column.references),
    );
  while (remaining.length > 0) {
    const index = Math.max(0, remaining.findIndex(ready));
    const [next] = remaining.splice(index, 1);
    if (!next) break;
    emitted.add(next.name);
    result.push(next);
  }
  return result;
}

export function buildSchema(model: Model): Schema {
  const drafts = new Map<string, Draft>();
  for (const name of model.order) {
    const draft = ensure(drafts, name, false);
    for (const attribute of model.attributes.get(name) ?? []) {
      draft.columns.push({ name: attribute, type: columnType(attribute) });
    }
  }
  for (const relation of model.relations) applyRelation(drafts, relation);
  const tables: Table[] = [...drafts.values()].map((draft) => ({
    name: draft.name,
    isJoin: draft.isJoin,
    columns: [...draft.columns],
  }));
  return { tables: topologicalOrder(tables) };
}
