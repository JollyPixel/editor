// Import Third-party Dependencies
import {
  TextEdit,
  type TextChange
} from "@jolly-pixel/asset.script/client";

// Import Internal Dependencies
import { TextLines } from "./TextLines.ts";

export interface TextSelection {
  readonly start: number;
  readonly end: number;
}

export interface KeyEdit {
  readonly edit: TextEdit;
  readonly selection: TextSelection;
}

// CONSTANTS
export const INDENT = "  ";
const kLeadingSpace = /^[\t ]*/;
const kOpeners = new Set(["{", "[", "("]);

export function insertIndent(
  text: string,
  selection: TextSelection
): KeyEdit {
  if (!spansLines(text, selection)) {
    const edit = TextEdit.deletion(selection.start, text.slice(selection.start, selection.end))
      .then(TextEdit.insertion(selection.start, INDENT));
    const caret = selection.start + INDENT.length;

    return {
      edit,
      selection: {
        start: caret,
        end: caret
      }
    };
  }

  return shiftLines(text, selection, (_line, at) => [{ at, insert: INDENT }]);
}

export function removeIndent(
  text: string,
  selection: TextSelection
): KeyEdit {
  return shiftLines(text, selection, (line, at) => {
    const leading = kLeadingSpace.exec(line)?.[0] ?? "";
    const removed = leading.startsWith("\t") ?
      "\t" :
      leading.slice(0, INDENT.length);

    return removed === "" ? [] : [{ at, delete: removed }];
  });
}

export function insertNewline(
  text: string,
  selection: TextSelection
): KeyEdit {
  const lines = new TextLines(text);
  const { line } = lines.position(selection.start);
  const before = text.slice(lines.lineStart(line), selection.start);
  const indent = kLeadingSpace.exec(before)?.[0] ?? "";
  const opens = kOpeners.has(before.trimEnd().at(-1) ?? "");
  const inserted = `\n${indent}${opens ? INDENT : ""}`;
  const edit = TextEdit.deletion(selection.start, text.slice(selection.start, selection.end))
    .then(TextEdit.insertion(selection.start, inserted));
  const caret = selection.start + inserted.length;

  return {
    edit,
    selection: {
      start: caret,
      end: caret
    }
  };
}

function spansLines(
  text: string,
  selection: TextSelection
): boolean {
  return text.slice(selection.start, selection.end).includes("\n");
}

function shiftLines(
  text: string,
  selection: TextSelection,
  change: (line: string, at: number) => TextChange[]
): KeyEdit {
  const lines = new TextLines(text);
  const first = lines.position(selection.start).line;
  const last = lines.position(Math.max(selection.start, selection.end - 1)).line;
  const changes: TextChange[] = [];
  let shift = 0;
  for (let line = first; line <= last; line++) {
    for (const lineChange of change(lines.lines[line], lines.lineStart(line) + shift)) {
      changes.push(lineChange);
      shift += "insert" in lineChange ?
        lineChange.insert.length :
        -lineChange.delete.length;
    }
  }
  const edit = new TextEdit(changes);

  return {
    edit,
    selection: {
      start: edit.mapPosition(selection.start, "before"),
      end: edit.mapPosition(selection.end)
    }
  };
}
