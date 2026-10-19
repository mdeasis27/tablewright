"use client";

import { useId, useMemo, useState } from "react";
import { HEADER_HEIGHT, layoutDiagram, ROW_HEIGHT } from "@/lib/diagram/layout";
import type { Schema } from "@/lib/types";

const TEXT_INSET = 12;

export function ErDiagram({ schema }: { schema: Schema }) {
  const diagram = useMemo(() => layoutDiagram(schema), [schema]);
  const [fit, setFit] = useState(false);
  const id = useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;
  const markerId = `${id}-arrow`;

  if (diagram.boxes.length === 0) {
    return <p className="empty">No tables yet. Describe an entity to see the diagram.</p>;
  }

  return (
    <div className="diagram">
      <div className="diagram-tools">
        <button
          type="button"
          className="btn btn-secondary"
          aria-pressed={fit}
          onClick={() => setFit((value) => !value)}
        >
          Fit to width
        </button>
      </div>
      <section
        className="diagram-scroll"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable region must be keyboard reachable
        tabIndex={0}
        aria-label="ER diagram, scrollable"
      >
        <svg
          role="img"
          aria-labelledby={`${titleId} ${descId}`}
          viewBox={`0 0 ${diagram.width} ${diagram.height}`}
          width={fit ? "100%" : diagram.width}
          height={fit ? undefined : diagram.height}
          className="diagram-svg"
        >
          <title id={titleId}>Entity-relationship diagram</title>
          <desc id={descId}>
            {`${diagram.boxes.length} tables and ${diagram.edges.length} foreign key relationships.`}
          </desc>
          <defs>
            <marker
              id={markerId}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="9"
              markerHeight="9"
              orient="auto-start-reverse"
            >
              <path d="M1 1 L9 5 L1 9" fill="none" stroke="var(--verdigris)" strokeWidth="1.6" />
            </marker>
          </defs>
          {diagram.edges.map((edge) => (
            <path
              key={`${edge.from}.${edge.column}`}
              d={edge.path}
              className="er-edge"
              markerEnd={`url(#${markerId})`}
            />
          ))}
          {diagram.boxes.map((box) => (
            <g key={box.table} transform={`translate(${box.x} ${box.y})`}>
              <rect className="er-box" width={box.width} height={box.height} />
              <rect
                className={box.isJoin ? "er-head er-head-join" : "er-head"}
                width={box.width}
                height={HEADER_HEIGHT}
              />
              <text className="er-title" x={TEXT_INSET} y={HEADER_HEIGHT / 2 + 5}>
                {box.table}
              </text>
              {box.rows.map((row, index) => {
                const y = HEADER_HEIGHT + index * ROW_HEIGHT + ROW_HEIGHT / 2 + 4;
                return (
                  <g key={row.name}>
                    <text
                      className={row.references ? "er-col er-col-fk" : "er-col"}
                      x={TEXT_INSET}
                      y={y}
                    >
                      {row.primaryKey ? `${row.name}  PK` : row.name}
                    </text>
                    <text
                      className={row.references ? "er-type er-col-fk" : "er-type"}
                      x={box.width - TEXT_INSET}
                      y={y}
                      textAnchor="end"
                    >
                      {row.references ? `→ ${row.references}` : row.type}
                    </text>
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      </section>
      <ul className="sr-only" aria-label="Foreign key relationships">
        {diagram.edges.map((edge) => (
          <li key={`${edge.from}.${edge.column}`}>
            {`${edge.from}.${edge.column} references ${edge.to}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
