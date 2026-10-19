/** Wordmark: a 3x2 table grid with a walnut "id" cell, plus the logotype. */
export function Logo() {
  return (
    <span className="logo">
      <svg
        className="logo-mark"
        width="28"
        height="28"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="3" y="5" width="6" height="7" fill="var(--walnut)" />
        <rect
          x="3"
          y="5"
          width="18"
          height="14"
          rx="2"
          fill="none"
          stroke="var(--ink)"
          strokeWidth="2"
        />
        <path d="M9 5v14M15 5v14M3 12h18" stroke="var(--ink)" strokeWidth="2" fill="none" />
      </svg>
      <span className="logo-type">Tablewright</span>
    </span>
  );
}
