const RESERVED_PREFIX = "sqlite_";

/** SQLite refuses user tables that start with `sqlite_`. */
export function safeName(name: string): string {
  return name.startsWith(RESERVED_PREFIX) ? `t_${name}` : name;
}

/** Singular snake_case table name for an entity written as Capitalized words. */
export function tableName(entity: string): string {
  return safeName(
    entity
      .split(" ")
      .filter((word) => word.length > 0)
      .map((word) => word.toLowerCase())
      .join("_"),
  );
}

function stripSuffix(word: string, suffix: string, replacement = ""): string {
  return `${word.slice(0, word.length - suffix.length)}${replacement}`;
}

function candidatesFor(word: string): string[] {
  const out: string[] = [];
  if (word.endsWith("ies")) out.push(stripSuffix(word, "ies", "y"));
  if (word.endsWith("es")) out.push(stripSuffix(word, "es"));
  if (word.endsWith("s")) out.push(stripSuffix(word, "s"));
  return out.filter((candidate) => candidate.length > 0);
}

const ES_FALLBACK = /(ses|xes|zes|ches|shes)$/;

function fallbackFor(word: string): string {
  if (word.endsWith("ies")) return stripSuffix(word, "ies", "y");
  if (ES_FALLBACK.test(word)) return stripSuffix(word, "es");
  if (word.endsWith("s")) return stripSuffix(word, "s");
  return word;
}

/**
 * Singular table name for a plural entity. Only the last word is singularised.
 * Prefers a candidate that is a known singular table, else the fallback rule.
 */
export function singularTable(plural: string, known: ReadonlySet<string>): string {
  const words = plural.split(" ").filter((word) => word.length > 0);
  const last = (words.pop() ?? "").toLowerCase();
  const prefix = words.map((word) => word.toLowerCase());
  const build = (word: string): string => safeName([...prefix, word].join("_"));
  const preferred = candidatesFor(last).find((candidate) => known.has(build(candidate)));
  return build(preferred ?? fallbackFor(last));
}
