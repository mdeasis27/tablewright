import type { Column, Schema, Table } from "../types";

export function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

function columnSql(column: Column): string {
  const base = `${quoteIdent(column.name)} ${column.type}`;
  if (column.primaryKey) return `${base} PRIMARY KEY`;
  if (column.references) return `${base} REFERENCES ${quoteIdent(column.references)}(id)`;
  return base;
}

function tableSql(table: Table): string {
  const body = table.columns.map((column) => `  ${columnSql(column)}`).join(",\n");
  return `CREATE TABLE ${quoteIdent(table.name)} (\n${body}\n);`;
}

/** DDL for the schema, one statement per table, ending with a single newline. */
export function emitDdl(schema: Schema): string {
  if (schema.tables.length === 0) return "";
  return `${schema.tables.map(tableSql).join("\n\n")}\n`;
}
