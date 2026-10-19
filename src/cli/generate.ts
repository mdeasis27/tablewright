import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generate } from "../lib/generate";

const USAGE_EXIT = 2;

function main(argv: readonly string[]): number {
  const file = argv[0];
  if (!file) {
    process.stderr.write("usage: generate <file>\n");
    return USAGE_EXIT;
  }
  let text: string;
  try {
    text = readFileSync(resolve(file), "utf8");
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    process.stderr.write(`cannot read ${file}: ${reason}\n`);
    return USAGE_EXIT;
  }
  const { ddl, warnings } = generate(text);
  for (const warning of warnings) {
    process.stderr.write(
      `warning: ignored sentence ${warning.index}: "${warning.sentence}" (${warning.reason})\n`,
    );
  }
  process.stdout.write(ddl);
  return 0;
}

process.exitCode = main(process.argv.slice(2));
