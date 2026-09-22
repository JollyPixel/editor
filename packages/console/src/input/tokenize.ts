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
    if (isWhitespace(line[index])) {
      index++;
      continue;
    }

    const start = index;
    if (line[index] === "\"") {
      let value = "";
      index++;
      let closed = false;
      while (index < line.length) {
        const char = line[index];
        if (
          char === "\\" &&
          (line[index + 1] === "\"" || line[index + 1] === "\\")
        ) {
          value += line[index + 1];
          index += 2;
          continue;
        }
        index++;
        if (char === "\"") {
          closed = true;
          break;
        }
        value += char;
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

    while (index < line.length && !isWhitespace(line[index])) {
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
  char: string
): boolean {
  return char === " " || char === "\t" || char === "\n" || char === "\r";
}
