const LEADING_ARTICLE = /^(?:a|an|the)\s+(?=\S)/i;
const LEADING_AND = /^and\s+(?=\S)/i;

function toColumnName(item: string): string {
  return item
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function splitItems(list: string): string[] {
  const parts = list.split(",").map((part) => part.trim());
  const last = parts.pop() ?? "";
  return [...parts, ...last.split(/\s+and\s+/i)];
}

/** Parse the tail of `A <Entity> has <attr list>` into snake_case column names. */
export function parseAttributes(list: string): string[] {
  const names = splitItems(list)
    .map((item) => item.trim().replace(LEADING_AND, "").replace(LEADING_ARTICLE, ""))
    .map(toColumnName)
    .filter((name) => name.length > 0 && name !== "id");
  return [...new Set(names)];
}
