import { type Analysis, MAX_INPUT_CHARS, type Validation } from "../lib/analysis";
import { generate } from "../lib/generate";
import { introspect, sqliteVersion } from "../lib/sqlite/sqlJs";

/** Generate DDL for the text, then really execute it in SQLite (sql.js) to validate. */
export async function analyze(text: string): Promise<Analysis> {
  if (text.length > MAX_INPUT_CHARS) {
    throw new RangeError(`Input is longer than ${MAX_INPUT_CHARS} characters`);
  }
  const { ddl, schema, warnings } = generate(text);
  const [result, version] = await Promise.all([introspect(ddl), sqliteVersion()]);
  const validation: Validation = result.ok
    ? { ok: true, tables: Object.keys(result.tables).length, version }
    : { ok: false, error: result.error };
  return { ddl, schema, warnings, validation };
}
