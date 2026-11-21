export type LineEnding = "\n" | "\r\n";

// CONSTANTS
const kLineBreak = /\r\n?/g;

export function toLf(
  text: string
): string {
  return text.replace(kLineBreak, "\n");
}
