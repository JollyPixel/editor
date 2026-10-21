// Import Internal Dependencies
import type { TourKeys } from "./TourKeys.ts";

// CONSTANTS
const kParagraphBreak = /\n\s*\n/;
const kKeySpan = /`([^`\n]+)`/g;
const kKeyPlaceholder = /^\{([^{}\s]+)\}$/;

export interface BodySpan {
  kind: "text" | "kbd" | "unbound";
  text: string;
}

export type BodyParagraph = readonly BodySpan[];

export function parseBody(
  body: string,
  keys: TourKeys | null = null
): BodyParagraph[] {
  return body
    .split(kParagraphBreak)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "")
    .map((paragraph) => parseSpans(paragraph, keys));
}

function parseSpans(
  paragraph: string,
  keys: TourKeys | null
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
    spans.push(keySpan(match[1], keys));
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

function keySpan(
  text: string,
  keys: TourKeys | null
): BodySpan {
  const name = kKeyPlaceholder.exec(text)?.[1];
  const labels = name === undefined ? undefined : keys?.labels(name);
  if (labels === undefined) {
    return {
      kind: "kbd",
      text
    };
  }

  const [label] = labels;

  return label === undefined ?
    {
      kind: "unbound",
      text: "unbound"
    } :
    {
      kind: "kbd",
      text: label
    };
}
