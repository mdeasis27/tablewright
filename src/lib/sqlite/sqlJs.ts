import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import { type ExecResult, introspectDb, type RawDb } from "./introspect";

let cached: Promise<SqlJsStatic> | undefined;

function sqlJs(): Promise<SqlJsStatic> {
  if (!cached) {
    const loading = initSqlJs();
    // A failed load must not be cached forever.
    loading.catch(() => {
      if (cached === loading) cached = undefined;
    });
    cached = loading;
  }
  return cached;
}

function wrap(db: Database): RawDb {
  return {
    exec: (sql) => {
      db.exec(sql);
    },
    rows: (sql) => {
      const [result] = db.exec(sql);
      if (!result) return [];
      return result.values.map((values) =>
        Object.fromEntries(result.columns.map((column, i) => [column, values[i]])),
      );
    },
    close: () => db.close(),
  };
}

/** WASM adapter for the Next.js server route. */
export async function introspect(ddl: string): Promise<ExecResult> {
  const SQL = await sqlJs();
  return introspectDb(wrap(new SQL.Database()), ddl);
}

export async function sqliteVersion(): Promise<string> {
  const SQL = await sqlJs();
  const db = new SQL.Database();
  try {
    return String(db.exec("select sqlite_version()")[0]?.values[0]?.[0] ?? "");
  } finally {
    db.close();
  }
}
