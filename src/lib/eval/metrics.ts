import type { ExecResult, TableInfo } from "../sqlite/introspect";

export type GoldTable = {
  readonly columns: readonly string[];
  readonly fks: Readonly<Record<string, string>>;
};
export type GoldSchema = Readonly<Record<string, GoldTable>>;

export type EvalCase = { readonly id: string; readonly text: string; readonly gold: GoldSchema };

export type SchemaSets = {
  readonly tables: ReadonlySet<string>;
  readonly columns: ReadonlySet<string>;
  readonly fks: ReadonlySet<string>;
};

export type CaseScore = {
  readonly executed: boolean;
  readonly tableF1: number;
  readonly columnF1: number;
  readonly fkF1: number;
  readonly score: number;
};

export type EvalReport = {
  cases: number;
  exec_rate: number;
  table_f1: number;
  column_f1: number;
  fk_f1: number;
  score: number;
};

const FAILED: CaseScore = { executed: false, tableF1: 0, columnF1: 0, fkF1: 0, score: 0 };

export function setsOf(schema: Readonly<Record<string, TableInfo | GoldTable>>): SchemaSets {
  const tables = new Set<string>();
  const columns = new Set<string>();
  const fks = new Set<string>();
  for (const [table, info] of Object.entries(schema)) {
    tables.add(table);
    for (const column of info.columns) columns.add(`${table}.${column}`);
    for (const [column, ref] of Object.entries(info.fks)) fks.add(`${table}.${column}->${ref}`);
  }
  return { tables, columns, fks };
}

export function f1(predicted: ReadonlySet<string>, gold: ReadonlySet<string>): number {
  if (predicted.size === 0 && gold.size === 0) return 1;
  const hits = [...predicted].filter((item) => gold.has(item)).length;
  if (hits === 0) return 0;
  const precision = hits / predicted.size;
  const recall = hits / gold.size;
  return (2 * precision * recall) / (precision + recall);
}

export function scoreCase(result: ExecResult, gold: GoldSchema): CaseScore {
  if (!result.ok) return FAILED;
  const predicted = setsOf(result.tables);
  const expected = setsOf(gold);
  const tableF1 = f1(predicted.tables, expected.tables);
  const columnF1 = f1(predicted.columns, expected.columns);
  const fkF1 = f1(predicted.fks, expected.fks);
  return { executed: true, tableF1, columnF1, fkF1, score: (tableF1 + columnF1 + fkF1) / 3 };
}

const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const round = (value: number, digits: number): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export function aggregate(scores: readonly CaseScore[]): EvalReport {
  return {
    cases: scores.length,
    exec_rate: round(mean(scores.map((s) => (s.executed ? 1 : 0))), 4),
    table_f1: round(mean(scores.map((s) => s.tableF1)), 4),
    column_f1: round(mean(scores.map((s) => s.columnF1)), 4),
    fk_f1: round(mean(scores.map((s) => s.fkF1)), 4),
    score: round(mean(scores.map((s) => s.score)) * 100, 2),
  };
}
