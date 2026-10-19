import type { EvalCase, GoldSchema, GoldTable } from "./metrics";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseGoldTable(value: unknown, where: string): GoldTable {
  if (!isRecord(value) || !Array.isArray(value.columns) || !isRecord(value.fks)) {
    throw new Error(`${where}: expected { columns: string[], fks: object }`);
  }
  const columns = value.columns.map(String);
  const fks = Object.fromEntries(Object.entries(value.fks).map(([key, ref]) => [key, String(ref)]));
  return { columns, fks };
}

function parseCase(value: unknown, index: number): EvalCase {
  if (!isRecord(value) || typeof value.text !== "string" || !isRecord(value.gold)) {
    throw new Error(`case #${index}: expected { id, text, gold }`);
  }
  const id = typeof value.id === "string" ? value.id : `#${index}`;
  const gold: GoldSchema = Object.fromEntries(
    Object.entries(value.gold).map(([table, info]) => [
      table,
      parseGoldTable(info, `case ${id} table ${table}`),
    ]),
  );
  return { id, text: value.text, gold };
}

/** Validate untrusted fixture JSON into eval cases. */
export function parseFixtures(json: unknown): EvalCase[] {
  if (!Array.isArray(json)) throw new Error("fixtures: expected a JSON array of cases");
  return json.map(parseCase);
}
