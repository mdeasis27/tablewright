import { emitDdl } from "./ddl/emit";
import { parse } from "./parse/parser";
import { buildSchema } from "./schema/build";
import type { GenerateResult } from "./types";

/** Plain English to schema, DDL and warnings. Pure and engine-free. */
export function generate(text: string): GenerateResult {
  const model = parse(text);
  const schema = buildSchema(model);
  return { ddl: emitDdl(schema), schema, warnings: model.warnings };
}
