// CONSTANTS
const kQuote = 0x22;
const kBackslash = 0x5C;
const kTab = 0x09;
const kWhitespaceBits = 0x800013;

export interface Token {
  value: string;
  start: number;
  end: number;
  quoted: boolean;
}

export interface TokenizedLine {
  tokens: Token[];
  unterminated: boolean;
}

export function tokenize(
  line: string
): TokenizedLine {
  const tokens: Token[] = [];
  let unterminated = false;
  let index = 0;

  while (index < line.length) {
    const code = line.charCodeAt(index);
    if (isWhitespace(code)) {
      index++;
      continue;
    }

    const start = index;
    if (code === kQuote) {
      let value = "";
      let chunk = ++index;
      let closed = false;
      while (index < line.length) {
        const char = line.charCodeAt(index);
        if (char === kQuote) {
          closed = true;
          break;
        }
        const next = line.charCodeAt(index + 1);
        if (char === kBackslash && (next === kQuote || next === kBackslash)) {
          value += line.slice(chunk, index);
          chunk = index + 1;
          index += 2;
          continue;
        }
        index++;
      }
      value += line.slice(chunk, index);
      if (closed) {
        index++;
      }
      unterminated ||= !closed;
      tokens.push({
        value,
        start,
        end: index,
        quoted: true
      });
      continue;
    }

    while (index < line.length && !isWhitespace(line.charCodeAt(index))) {
      index++;
    }
    tokens.push({
      value: line.slice(start, index),
      start,
      end: index,
      quoted: false
    });
  }

  return {
    tokens,
    unterminated
  };
}

export function quote(
  value: string
): string {
  if (value !== "" && !/[\s"\\]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"`;
}

function isWhitespace(
  code: number
): boolean {
  const offset = code - kTab;

  return offset >= 0 && offset < 24 && ((kWhitespaceBits >>> offset) & 1) === 1;
}
