import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { generate } from "../src/lib/generate";

const ROOT = resolve(import.meta.dir, "..");
const dir = mkdtempSync(join(tmpdir(), "tablewright-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function run(args: string[], cwd = ROOT) {
  const proc = Bun.spawnSync(["bun", ...args], { cwd });
  return {
    code: proc.exitCode,
    out: proc.stdout.toString(),
    err: proc.stderr.toString(),
  };
}

describe("generate CLI", () => {
  const text = "A Book has a title. Each Book belongs to one Author. This is noise.";
  const file = join(dir, "in.txt");
  writeFileSync(file, text);

  test("stdout is exactly the DDL; warnings go to stderr", () => {
    const { out, err, code } = run(["src/cli/generate.ts", file]);
    expect(code).toBe(0);
    expect(out).toBe(generate(text).ddl);
    expect(err).toContain("warning: ignored sentence 3");
  });

  test("works through the package script with nothing but DDL on stdout", () => {
    const { out, code } = run(["run", "--silent", "generate", file]);
    expect(code).toBe(0);
    expect(out).toBe(generate(text).ddl);
  });

  test("resolves relative paths from the caller's working directory", () => {
    const { out, code } = run([resolve(ROOT, "src/cli/generate.ts"), "in.txt"], dir);
    expect(code).toBe(0);
    expect(out).toBe(generate(text).ddl);
  });

  test("warnings-only input prints nothing on stdout and exits 0", () => {
    const only = join(dir, "noise.txt");
    writeFileSync(only, "Nothing matches here.");
    const { out, err, code } = run(["src/cli/generate.ts", only]);
    expect([code, out]).toEqual([0, ""]);
    expect(err).toContain("warning");
  });

  test("a missing file is a usage error on stderr", () => {
    const { out, err, code } = run(["src/cli/generate.ts", join(dir, "nope.txt")]);
    expect([code, out]).toEqual([2, ""]);
    expect(err).toContain("cannot read");
  });
});

describe("eval CLI", () => {
  test("prints exactly one JSON object with the documented keys", () => {
    const { out, code } = run(["src/cli/eval.ts"]);
    expect(code).toBe(0);
    const lines = out.trim().split("\n");
    expect(lines).toHaveLength(1);
    const report = JSON.parse(lines[0] ?? "{}");
    expect(Object.keys(report)).toEqual([
      "cases",
      "exec_rate",
      "table_f1",
      "column_f1",
      "fk_f1",
      "score",
    ]);
    expect(report.score).toBe(100);
  });

  test("a malformed fixture file exits non-zero with a message", () => {
    const bad = join(dir, "bad.json");
    writeFileSync(bad, "{}");
    const { err, code } = run(["src/cli/eval.ts", bad]);
    expect(code).toBe(1);
    expect(err).toContain("eval failed");
  });
});

function sourceFiles(root: string): string[] {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("import isolation", () => {
  test("nothing in the Next.js graph imports bun:sqlite or the bun adapter", () => {
    const offenders = [
      ...sourceFiles(join(ROOT, "src/app")),
      ...sourceFiles(join(ROOT, "src/components")),
    ].filter((file) => /bun:sqlite|bunSqlite/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  test("the pure library never imports an engine", () => {
    const lib = sourceFiles(join(ROOT, "src/lib")).filter((f) => !f.includes("sqlite"));
    const offenders = lib.filter((file) => /bun:sqlite|sql\.js/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});
