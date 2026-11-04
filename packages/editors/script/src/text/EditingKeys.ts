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

// CONSTANTS
export const INDENT = "  ";
const kLeadingSpace = /^[\t ]*/;
const kOpeners = new Set(["{", "[", "("]);

export function insertIndent(
  lines: TextLines,
  caret: ScriptCaret
): KeyEdit {
  if (!spansLines(lines, caret)) {
    return replaceSelection(lines, caret, INDENT);
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
  const opens = kOpeners.has(before.trimEnd().at(-1) ?? "");

  return replaceSelection(lines, caret, `\n${indent}${opens ? INDENT : ""}`);
}

function spansLines(
  lines: TextLines,
  caret: ScriptCaret
): boolean {
  return lines.text.slice(caret.start, caret.end).includes("\n");
}

function replaceSelection(
  lines: TextLines,
  caret: ScriptCaret,
  inserted: string
): KeyEdit {
  const edit = TextEdit.deletion(caret.start, lines.text.slice(caret.start, caret.end))
    .then(TextEdit.insertion(caret.start, inserted));

  return {
    edit,
    caret: ScriptCaret.collapsed(caret.start + inserted.length)
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
