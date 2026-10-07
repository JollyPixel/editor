// Import Internal Dependencies
import { ConsoleInputError } from "../execution/errors/ConsoleInputError.ts";

// CONSTANTS
const kQuote = "\"";
const kBackslash = "\\";
const kCommentStart = /^\s*[;#]/;

export interface ScriptSpan {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

export interface BlankLine {
  readonly kind: "blank";
  readonly text: string;
}

export interface CommentLine {
  readonly kind: "comment";
  readonly text: string;
  readonly comment: ScriptSpan;
}

export interface SectionLine {
  readonly kind: "section";
  readonly text: string;
  readonly name: ScriptSpan;
  readonly closed: boolean;
}

export interface EntryLine {
  readonly kind: "entry";
  readonly text: string;
  readonly key: ScriptSpan;
  readonly operator: number;
  readonly value: ScriptSpan;
}

export interface InvalidLine {
  readonly kind: "invalid";
  readonly text: string;
}

export type ScriptLine =
  | BlankLine
  | CommentLine
  | SectionLine
  | EntryLine
  | InvalidLine;

export function scanScript(
  text: string
): ScriptLine[] {
  return text.split(/\r?\n/).map(scanLine);
}

export function scanLine(
  text: string
): ScriptLine {
  if (text.trim() === "") {
    return {
      kind: "blank",
      text
    };
  }
  if (kCommentStart.test(text)) {
    return {
      kind: "comment",
      text,
      comment: trimmedSpan(text, 0, text.length)
    };
  }

  const start = text.length - text.trimStart().length;
  if (text[start] === "[") {
    const close = text.indexOf("]", start);
    const end = close === -1 ? text.length : close;

    return {
      kind: "section",
      text,
      name: trimmedSpan(text, start + 1, end),
      closed: close !== -1 && text.slice(close + 1).trim() === ""
    };
  }

  const operator = text.indexOf("=");
  if (operator === -1) {
    return {
      kind: "invalid",
      text
    };
  }

  return {
    kind: "entry",
    text,
    key: trimmedSpan(text, 0, operator),
    operator,
    value: trimmedSpan(text, operator + 1, text.length)
  };
}

export function formatScriptValue(
  value: string
): string {
  if (
    value !== "" &&
    value.trim() === value &&
    !value.startsWith(kQuote)
  ) {
    return value;
  }

  const escaped = value
    .replaceAll(kBackslash, "\\\\")
    .replaceAll(kQuote, "\\\"");

  return `"${escaped}"`;
}

export function parseScriptValue(
  value: string
): string {
  if (!value.startsWith(kQuote)) {
    return value;
  }

  let literal = "";
  let index = 1;
  while (index < value.length) {
    const char = value[index];
    if (char === kQuote) {
      if (index !== value.length - 1) {
        throw new ConsoleInputError("Unexpected text after the closing quote");
      }

      return literal;
    }
    const next = value[index + 1];
    if (char === kBackslash && (next === kQuote || next === kBackslash)) {
      literal += next;
      index += 2;
      continue;
    }
    literal += char;
    index++;
  }

  throw new ConsoleInputError("Unterminated quote");
}

function trimmedSpan(
  line: string,
  from: number,
  to: number
): ScriptSpan {
  const raw = line.slice(from, to);
  const start = from + raw.length - raw.trimStart().length;
  const text = raw.trim();

  return {
    start,
    end: start + text.length,
    text
  };
}
