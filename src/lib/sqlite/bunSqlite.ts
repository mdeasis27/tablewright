import { Database } from "bun:sqlite";
import { type ExecResult, introspectDb, type RawDb } from "./introspect";

function open(): RawDb {
  const db = new Database(":memory:");
  return {
    exec: (sql) => db.exec(sql),
    rows: (sql) => db.query(sql).all() as Record<string, unknown>[],
    close: () => db.close(),
  };
}

/** Bun-only adapter: used by the CLIs and the tests, never by the Next.js graph. */
export async function introspect(ddl: string): Promise<ExecResult> {
  return introspectDb(open(), ddl);
}
