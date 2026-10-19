import { parseAttributes } from "./attributes";

const ENTITY = "([A-Z][A-Za-z0-9]*(?: [A-Z][A-Za-z0-9]*)*)";

/** Case-insensitive fixed keywords without the `i` flag, so `[A-Z]` stays strict. */
function ci(phrase: string): string {
  return phrase.replace(/[a-z]/gi, (c) => `[${c.toLowerCase()}${c.toUpperCase()}]`);
}

const ARTICLE = `${ci("a")}${ci("n")}?`;
const HAS_MANY = new RegExp(`^${ARTICLE} ${ENTITY} ${ci("has many")} ${ENTITY}$`);
const BELONGS_TO = new RegExp(`^${ci("each")} ${ENTITY} ${ci("belongs to one")} ${ENTITY}$`);
const RELATE = new RegExp(`^${ci("many")} ${ENTITY} ${ci("relate to many")} ${ENTITY}$`);
const HAS = new RegExp(`^${ARTICLE} ${ENTITY} ${ci("has")} (.+)$`);

export type Matched =
  | { readonly kind: "hasMany"; readonly owner: string; readonly pluralChild: string }
  | { readonly kind: "belongsTo"; readonly child: string; readonly owner: string }
  | { readonly kind: "relate"; readonly pluralA: string; readonly pluralB: string }
  | { readonly kind: "entity"; readonly entity: string; readonly attributes: readonly string[] }
  | { readonly kind: "emptyEntity"; readonly entity: string }
  | { readonly kind: "none" };

export function matchSentence(sentence: string): Matched {
  const hasMany = HAS_MANY.exec(sentence);
  if (hasMany?.[1] && hasMany[2]) {
    return { kind: "hasMany", owner: hasMany[1], pluralChild: hasMany[2] };
  }
  const belongs = BELONGS_TO.exec(sentence);
  if (belongs?.[1] && belongs[2]) {
    return { kind: "belongsTo", child: belongs[1], owner: belongs[2] };
  }
  const relate = RELATE.exec(sentence);
  if (relate?.[1] && relate[2]) {
    return { kind: "relate", pluralA: relate[1], pluralB: relate[2] };
  }
  const has = HAS.exec(sentence);
  if (has?.[1] && has[2] !== undefined) {
    const attributes = parseAttributes(has[2]);
    return attributes.length > 0
      ? { kind: "entity", entity: has[1], attributes }
      : { kind: "emptyEntity", entity: has[1] };
  }
  return { kind: "none" };
}
