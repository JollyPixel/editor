// Import Third-party Dependencies
import {
  TextEdit,
  type TextChange
} from "@jolly-pixel/asset.script/client";

// Import Internal Dependencies
import { LineRange } from "./LineRange.ts";
import { ScriptCaret } from "./ScriptCaret.ts";
import type { TextLines } from "./TextLines.ts";

export interface KeyEdit {
  readonly edit: TextEdit;
  readonly caret: ScriptCaret;
}

export type KeyCommand = (
  lines: TextLines,
  caret: ScriptCaret
) => KeyEdit | null;

// CONSTANTS
export const INDENT = "  ";
const kLeadingSpace = /^[\t ]*/;
const kBrackets = new Map([
  ["(", ")"],
  ["[", "]"],
  ["{", "}"]
]);
const kQuotes = new Set(["\"", "'", "`"]);
const kClosers = new Set([...kBrackets.values(), ...kQuotes]);
const kClosesBefore = /^(?:[\s)\]};,:.=>]|$)/;
const kKeepsQuoteSingle = /^[\p{ID_Continue}$\\]$/u;

export function insertIndent(
  lines: TextLines,
  caret: ScriptCaret
): KeyEdit {
  if (!spansLines(lines, caret)) {
    return replaceRange(lines, caret.start, caret.end, INDENT);
  }

  return shiftLines(lines, caret, (_line, at) => [{ at, insert: INDENT }]);
}

export function removeIndent(
  lines: TextLines,
  caret: ScriptCaret
): KeyEdit {
  return shiftLines(lines, caret, (line, at) => {
    const leading = kLeadingSpace.exec(line)?.[0] ?? "";
    const removed = leading.startsWith("\t") ?
      "\t" :
      leading.slice(0, INDENT.length);

    return removed === "" ? [] : [{ at, delete: removed }];
  });
}

export function insertNewline(
  lines: TextLines,
  caret: ScriptCaret
): KeyEdit {
  const before = lines.lineBefore(caret.start);
  const indent = kLeadingSpace.exec(before)?.[0] ?? "";
  const closer = kBrackets.get(before.trimEnd().at(-1) ?? "");
  if (closer === undefined) {
    return replaceRange(lines, caret.start, caret.end, `\n${indent}`);
  }

  const inner = `\n${indent}${INDENT}`;
  const outer = lines.text[caret.end] === closer ? `\n${indent}` : "";

  return replaceRange(
    lines,
    caret.start,
    caret.end,
    `${inner}${outer}`,
    caret.start + inner.length
  );
}

export function typeCharacter(
  lines: TextLines,
  caret: ScriptCaret,
  character: string
): KeyEdit | null {
  if (!caret.collapsed) {
    return null;
  }

  const at = caret.start;
  const next = lines.text[at] ?? "";
  if (next === character && kClosers.has(character)) {
    return replaceRange(lines, at, at, "", at + 1);
  }

  const quote = kQuotes.has(character);
  const closer = matchingCloser(character);
  if (closer === undefined || !kClosesBefore.test(next)) {
    return null;
  }
  if (quote && kKeepsQuoteSingle.test(lines.text[at - 1] ?? "")) {
    return null;
  }

  return replaceRange(lines, at, at, `${character}${closer}`, at + 1);
}

export function deleteBackward(
  lines: TextLines,
  caret: ScriptCaret
): KeyEdit | null {
  const at = caret.start;
  const closer = matchingCloser(lines.text[at - 1] ?? "");
  if (!caret.collapsed || closer === undefined || lines.text[at] !== closer) {
    return null;
  }

  return replaceRange(lines, at - 1, at + 1, "", at - 1);
}

function matchingCloser(
  opener: string
): string | undefined {
  return kQuotes.has(opener) ? opener : kBrackets.get(opener);
}

function spansLines(
  lines: TextLines,
  caret: ScriptCaret
): boolean {
  return lines.text.slice(caret.start, caret.end).includes("\n");
}

function replaceRange(
  lines: TextLines,
  from: number,
  to: number,
  inserted: string,
  caret = from + inserted.length
): KeyEdit {
  const edit = TextEdit.deletion(from, lines.text.slice(from, to))
    .then(TextEdit.insertion(from, inserted));

  return {
    edit,
    caret: ScriptCaret.collapsed(caret)
  };
}

function shiftLines(
  lines: TextLines,
  caret: ScriptCaret,
  change: (line: string, at: number) => TextChange[]
): KeyEdit {
  const changes: TextChange[] = [];
  let shift = 0;
  for (const line of shiftedLines(lines, caret)) {
    for (const lineChange of change(lines.line(line), lines.lineStart(line) + shift)) {
      changes.push(lineChange);
      shift += "insert" in lineChange ?
        lineChange.insert.length :
        -lineChange.delete.length;
    }
  }
  const edit = new TextEdit(changes);

  return {
    edit,
    caret: caret.resized(
      edit.mapPosition(caret.start, "before"),
      edit.mapPosition(caret.end)
    )
  };
}

function shiftedLines(
  lines: TextLines,
  caret: ScriptCaret
): LineRange {
  return new LineRange(
    lines.position(caret.start).line,
    lines.position(Math.max(caret.start, caret.end - 1)).line
  );
}
