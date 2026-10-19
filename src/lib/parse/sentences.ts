/** Normalise whitespace and split on `.` followed by whitespace or end of input. */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/\.(?=\s|$)/)
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0);
}
