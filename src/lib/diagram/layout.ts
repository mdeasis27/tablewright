import type { Schema, Table } from "../types";

export const BOX_WIDTH = 220;
export const HEADER_HEIGHT = 32;
export const ROW_HEIGHT = 24;
const GAP_X = 96;
const GAP_Y = 28;
const PAD = 24;
const LOOP_BULGE = 56;

export type BoxRow = {
  readonly name: string;
  readonly type: string;
  readonly primaryKey: boolean;
  readonly references: string | null;
  /** Vertical centre of the row in diagram coordinates. */
  readonly centerY: number;
};

export type Box = {
  readonly table: string;
  readonly isJoin: boolean;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rows: readonly BoxRow[];
};

export type Edge = {
  readonly from: string;
  readonly column: string;
  readonly to: string;
  readonly path: string;
};

export type Diagram = {
  readonly width: number;
  readonly height: number;
  readonly boxes: readonly Box[];
  readonly edges: readonly Edge[];
};

function refsOf(table: Table): string[] {
  return table.columns.flatMap((c) =>
    c.references && c.references !== table.name ? [c.references] : [],
  );
}

/** Layer = longest FK path to a table with no references; cycles are cut on re-entry. */
function layerOf(
  name: string,
  byName: ReadonlyMap<string, Table>,
  memo: Map<string, number>,
  visiting: Set<string>,
): number {
  const known = memo.get(name);
  if (known !== undefined) return known;
  const table = byName.get(name);
  if (!table || visiting.has(name)) return 0;
  visiting.add(name);
  const deepest = Math.max(-1, ...refsOf(table).map((ref) => layerOf(ref, byName, memo, visiting)));
  visiting.delete(name);
  memo.set(name, deepest + 1);
  return deepest + 1;
}

function boxHeight(table: Table): number {
  return HEADER_HEIGHT + table.columns.length * ROW_HEIGHT;
}

function makeBox(table: Table, x: number, y: number): Box {
  return {
    table: table.name,
    isJoin: table.isJoin,
    x,
    y,
    width: BOX_WIDTH,
    height: boxHeight(table),
    rows: table.columns.map((column, index) => ({
      name: column.name,
      type: column.type,
      primaryKey: column.primaryKey === true,
      references: column.references ?? null,
      centerY: y + HEADER_HEIGHT + index * ROW_HEIGHT + ROW_HEIGHT / 2,
    })),
  };
}

function edgePath(from: Box, fromY: number, to: Box, toY: number): string {
  if (to.x + to.width <= from.x) {
    const startX = from.x;
    const endX = to.x + to.width;
    const mid = (startX + endX) / 2;
    return `M ${startX} ${fromY} C ${mid} ${fromY}, ${mid} ${toY}, ${endX} ${toY}`;
  }
  const startX = from.x + from.width;
  const endX = to.x + to.width;
  const out = Math.max(startX, endX) + LOOP_BULGE;
  return `M ${startX} ${fromY} C ${out} ${fromY}, ${out} ${toY}, ${endX} ${toY}`;
}

function edgesOf(boxes: readonly Box[]): Edge[] {
  const byName = new Map(boxes.map((box) => [box.table, box]));
  return boxes.flatMap((box) =>
    box.rows.flatMap((row) => {
      const target = row.references ? byName.get(row.references) : undefined;
      if (!target || !row.references) return [];
      const idRow = target.rows.find((r) => r.primaryKey) ?? target.rows[0];
      const toY = idRow?.centerY ?? target.y + HEADER_HEIGHT / 2;
      return [
        {
          from: box.table,
          column: row.name,
          to: row.references,
          path: edgePath(box, row.centerY, target, toY),
        },
      ];
    }),
  );
}

/** Deterministic layered layout: referenced tables left, referencing tables right. */
export function layoutDiagram(schema: Schema): Diagram {
  const byName = new Map(schema.tables.map((table) => [table.name, table]));
  const memo = new Map<string, number>();
  const columns = new Map<number, Table[]>();
  for (const table of schema.tables) {
    const layer = layerOf(table.name, byName, memo, new Set());
    columns.set(layer, [...(columns.get(layer) ?? []), table]);
  }
  const boxes: Box[] = [];
  let height = 0;
  for (const [layer, tables] of [...columns.entries()].sort((a, b) => a[0] - b[0])) {
    let y = PAD;
    for (const table of tables) {
      boxes.push(makeBox(table, PAD + layer * (BOX_WIDTH + GAP_X), y));
      y += boxHeight(table) + GAP_Y;
    }
    height = Math.max(height, y - GAP_Y + PAD);
  }
  const layers = columns.size;
  if (layers === 0) return { width: 0, height: 0, boxes, edges: [] };
  const width = layers * BOX_WIDTH + (layers - 1) * GAP_X + 2 * PAD + LOOP_BULGE;
  return { width, height, boxes, edges: edgesOf(boxes) };
}
