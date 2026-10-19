"use client";

import { type KeyboardEvent, useId, useRef, useState } from "react";
import type { Analysis, ApiResponse } from "@/lib/analysis";
import { ErDiagram } from "./ErDiagram";

type Props = { readonly initialText: string; readonly initial: Analysis };

async function requestAnalysis(text: string): Promise<Analysis> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  let body: ApiResponse<Analysis>;
  try {
    body = (await response.json()) as ApiResponse<Analysis>;
  } catch {
    throw new Error(`The server returned an unexpected response (HTTP ${response.status})`);
  }
  if (!body.success) throw new Error(body.error);
  return body.data;
}

function Status({ analysis, busy }: { analysis: Analysis; busy: boolean }) {
  if (busy) return <p className="status status-busy">Generating…</p>;
  const { validation } = analysis;
  if (analysis.ddl === "") {
    return <p className="status status-empty">Nothing to validate yet.</p>;
  }
  return validation.ok ? (
    <p className="status status-ok">
      <span aria-hidden="true">✓ </span>
      {`Valid: executed in SQLite ${validation.version}, ${validation.tables} ${
        validation.tables === 1 ? "table" : "tables"
      }`}
    </p>
  ) : (
    <p className="status status-err">
      <span aria-hidden="true">✕ </span>
      {`Error: ${validation.error}`}
    </p>
  );
}

export function Workbench({ initialText, initial }: Props) {
  const inputId = useId();
  const [text, setText] = useState(initialText);
  const [analysis, setAnalysis] = useState<Analysis>(initial);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [copyNote, setCopyNote] = useState("");
  const ddlRef = useRef<HTMLPreElement>(null);

  async function generate(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    setCopyNote("");
    try {
      setAnalysis(await requestAnalysis(text));
    } catch (error: unknown) {
      setFailure(error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void generate();
    }
  }

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(analysis.ddl);
      setCopyNote("Copied DDL to clipboard");
    } catch {
      const node = ddlRef.current;
      if (node) window.getSelection()?.selectAllChildren(node);
      setCopyNote("Copy blocked: DDL selected, press Ctrl+C");
    }
  }

  return (
    <div className="workbench">
      <section className="panel panel-input" aria-labelledby={`${inputId}-h`}>
        <h2 id={`${inputId}-h`}>Describe your data</h2>
        <label htmlFor={inputId} className="field-label">
          Data model in plain English
        </label>
        <textarea
          id={inputId}
          className="input"
          value={text}
          rows={10}
          spellCheck={false}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          aria-describedby={`${inputId}-hint`}
        />
        <p id={`${inputId}-hint`} className="hint">
          Sentences end with a period. Try “A Book has a title.”, “Each Book belongs to one
          Author.”, “A Customer has many Orders.” or “Many Tags relate to many Articles.”
        </p>
        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void generate()}
          >
            Generate schema
          </button>
          <span className="hint">or press Ctrl+Enter (Cmd+Enter on Mac)</span>
        </div>
        <div role="status" aria-live="polite">
          <Status analysis={analysis} busy={busy} />
        </div>
        {failure ? (
          <p className="status status-err" role="alert">
            {failure}
          </p>
        ) : null}
        {analysis.warnings.length > 0 ? (
          <div className="warnings">
            <h3>
              {`Ignored ${analysis.warnings.length} ${
                analysis.warnings.length === 1 ? "sentence" : "sentences"
              }`}
            </h3>
            <ul>
              {analysis.warnings.map((warning) => (
                <li key={warning.index}>
                  <span className="warn-num">{`#${warning.index}`}</span> {warning.sentence}{" "}
                  <span className="hint">{`(${warning.reason})`}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <div className="panel-stack">
        <section className="panel" aria-labelledby={`${inputId}-ddl`}>
          <div className="panel-head">
            <h2 id={`${inputId}-ddl`}>SQLite DDL</h2>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void copy()}
              disabled={analysis.ddl === ""}
            >
              Copy DDL
            </button>
          </div>
          <pre className="ddl" ref={ddlRef}>
            <code>{analysis.ddl === "" ? "-- no tables yet" : analysis.ddl}</code>
          </pre>
          <p className="sr-only" role="status" aria-live="polite">
            {copyNote}
          </p>
          {copyNote ? <p className="hint">{copyNote}</p> : null}
        </section>
        <section className="panel" aria-labelledby={`${inputId}-er`}>
          <h2 id={`${inputId}-er`}>ER diagram</h2>
          <ErDiagram schema={analysis.schema} />
        </section>
      </div>
    </div>
  );
}
