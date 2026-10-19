import type { Schema, Warning } from "./types";

export const MAX_INPUT_CHARS = 20_000;

export type Validation =
  | { readonly ok: true; readonly tables: number; readonly version: string }
  | { readonly ok: false; readonly error: string };

/** Everything the page needs to render one generation. */
export type Analysis = {
  readonly ddl: string;
  readonly schema: Schema;
  readonly warnings: readonly Warning[];
  readonly validation: Validation;
};

/** Standard response envelope used by the API route. */
export type ApiResponse<T> =
  | { readonly success: true; readonly data: T; readonly error: null }
  | { readonly success: false; readonly data: null; readonly error: string };

export const EXAMPLE_TEXT = [
  "A Blog Post has a title, a body and a published at.",
  "An Author has a display name.",
  "Each Blog Post belongs to one Author.",
  "A Blog Post has many Comments.",
  "A Comment has a body.",
  "Many Blog Posts relate to many Tags.",
  "A Tag has a label.",
].join("\n");
