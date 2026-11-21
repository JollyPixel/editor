// Import Third-party Dependencies
import type { Token } from "marked";

// CONSTANTS
const kComment = /<!--[\s\S]*?-->/g;
const kCode = /(`+)[\s\S]*?\1/g;
const kTag = /<(\/?)([a-z][\w-]*)(?=[\s/>])[^>]*?(\/?)>/gi;
const kVoidElements = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr"
]);

export function leavesElementsOpen(
  token: Token
): boolean {
  if (token.type === "code" || !token.raw.includes("<")) {
    return false;
  }

  const markup = token.raw.replace(kCode, "").replace(kComment, "");
  if (markup.includes("<!--")) {
    return true;
  }
  const open: string[] = [];
  for (const [, closing, name, selfClosing] of markup.matchAll(kTag)) {
    const element = name.toLowerCase();
    if (kVoidElements.has(element) || selfClosing === "/") {
      continue;
    }
    if (closing === "") {
      open.push(element);
    }
    else if (open.pop() !== element) {
      return true;
    }
  }

  return open.length > 0;
}
