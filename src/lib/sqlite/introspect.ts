export type TableInfo = {
  readonly columns: readonly string[];
  /** FK column name to referenced table. */
  readonly fks: Readonly<Record<string, string>>;
};

export type ExecResult =
  | { readonly ok: true; readonly tables: Readonly<Record<string, TableInfo>> }
  | { readonly ok: false; readonly error: string };

/** Minimal synchronous SQLite handle both adapters implement. */
export interface RawDb {
  exec(sql: string): void;
  rows(sql: string): Record<string, unknown>[];
  close(): void;
}

function quote(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : String(value);
}

function describeTable(db: RawDb, table: string): TableInfo {
  const columns = db.rows(`PRAGMA table_info(${quote(table)})`).map((row) => text(row.name));
  const fks: Record<string, string> = {};
  for (const row of db.rows(`PRAGMA foreign_key_list(${quote(table)})`)) {
    fks[text(row.from)] = text(row.table);
  }
  return { columns, fks };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Execute DDL top to bottom with foreign keys on, then introspect the result. */
export function introspectDb(db: RawDb, ddl: string): ExecResult {
  try {
    db.exec("PRAGMA foreign_keys = ON");
    if (ddl.trim() !== "") db.exec(ddl);
    const names = db
      .rows("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .map((row) => text(row.name));
    const tables: Record<string, TableInfo> = {};
    for (const name of names) tables[name] = describeTable(db, name);
    return { ok: true, tables };
  } catch (error: unknown) {
    return { ok: false, error: errorMessage(error) };
  } finally {
    db.close();
  }
}
