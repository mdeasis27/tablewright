export type Warning = {
  readonly sentence: string;
  readonly index: number;
  readonly reason: string;
};

export type Relation =
  | { readonly kind: "fk"; readonly from: string; readonly to: string }
  | { readonly kind: "m2m"; readonly a: string; readonly b: string };

export type Model = {
  /** Entity table names in first-mention order. */
  readonly order: readonly string[];
  /** Attribute columns per entity table, in declaration order. */
  readonly attributes: ReadonlyMap<string, readonly string[]>;
  readonly relations: readonly Relation[];
  readonly warnings: readonly Warning[];
};

export type ColumnType = "INTEGER" | "REAL" | "TEXT";

export type Column = {
  readonly name: string;
  readonly type: ColumnType;
  readonly primaryKey?: true;
  readonly references?: string;
};

export type Table = {
  readonly name: string;
  readonly columns: readonly Column[];
  readonly isJoin: boolean;
};

export type Schema = { readonly tables: readonly Table[] };

export type GenerateResult = {
  readonly ddl: string;
  readonly schema: Schema;
  readonly warnings: readonly Warning[];
};
