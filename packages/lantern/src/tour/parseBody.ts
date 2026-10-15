// CONSTANTS
const kParagraphBreak = /\n\s*\n/;
const kKeySpan = /`([^`\n]+)`/g;

export interface BodySpan {
  kind: "text" | "kbd";
  text: string;
}

export type BodyParagraph = readonly BodySpan[];

export function parseBody(
  body: string
): BodyParagraph[] {
  return body
    .split(kParagraphBreak)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "")
    .map(parseSpans);
}

function parseSpans(
  paragraph: string
): BodyParagraph {
  const spans: BodySpan[] = [];
  let cursor = 0;
  for (const match of paragraph.matchAll(kKeySpan)) {
    if (match.index > cursor) {
      spans.push({
        kind: "text",
        text: paragraph.slice(cursor, match.index)
      });
    }
    spans.push({
      kind: "kbd",
      text: match[1]
    });
    cursor = match.index + match[0].length;
  }
  if (cursor < paragraph.length) {
    spans.push({
      kind: "text",
      text: paragraph.slice(cursor)
    });
  }

  return spans;
}
