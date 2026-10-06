// Import Internal Dependencies
import type { ConsoleValueType } from "../registry/types.ts";
import type { ScriptLine } from "./scanScript.ts";

export type ScriptTokenKind =
  | "comment"
  | "section"
  | "key"
  | "operator"
  | `value-${ConsoleValueType}`
  | "value";

export interface ScriptRange {
  readonly start: number;
  readonly end: number;
}

export interface HighlightPiece {
  readonly text: string;
  readonly kind: ScriptTokenKind | null;
  readonly error: boolean;
}

interface Token extends ScriptRange {
  kind: ScriptTokenKind;
}

export function highlightLine(
  line: ScriptLine,
  valueType: ConsoleValueType | undefined,
  errors: Iterable<ScriptRange> = []
): HighlightPiece[] {
  const { text } = line;
  const tokens = tokensOf(line, valueType);
  const errorRanges = [...errors];
  const cuts = new Set([0, text.length]);
  for (const range of [...tokens, ...errorRanges]) {
    cuts.add(Math.max(0, Math.min(range.start, text.length)));
    cuts.add(Math.max(0, Math.min(range.end, text.length)));
  }
  const sorted = [...cuts].sort((left, right) => left - right);

  const pieces: HighlightPiece[] = [];
  for (let index = 1; index < sorted.length; index++) {
    const start = sorted[index - 1];
    const end = sorted[index];
    const kind = tokens.find((token) => covers(token, start))?.kind ?? null;
    const error = errorRanges.some((range) => covers(range, start));
    const last = pieces.at(-1);
    if (last !== undefined && last.kind === kind && last.error === error) {
      pieces[pieces.length - 1] = {
        text: last.text + text.slice(start, end),
        kind,
        error
      };
      continue;
    }
    pieces.push({
      text: text.slice(start, end),
      kind,
      error
    });
  }

  return pieces;
}

function tokensOf(
  line: ScriptLine,
  valueType: ConsoleValueType | undefined
): Token[] {
  switch (line.kind) {
    case "comment":
      return [
        {
          ...line.comment,
          kind: "comment"
        }
      ];
    case "section": {
      const start = line.text.length - line.text.trimStart().length;

      return [
        {
          start,
          end: line.text.trimEnd().length,
          kind: "section"
        }
      ];
    }
    case "entry":
      return [
        {
          ...line.key,
          kind: "key"
        },
        {
          start: line.operator,
          end: line.operator + 1,
          kind: "operator"
        },
        {
          ...line.value,
          kind: valueType === undefined ? "value" : `value-${valueType}`
        }
      ];
    default:
      return [];
  }
}

function covers(
  range: ScriptRange,
  offset: number
): boolean {
  return offset >= range.start && offset < range.end;
}
