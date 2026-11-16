// CONSTANTS
const kAnchors = [
  /<head(?:\s[^>]*)?>/i,
  /<!doctype[^>]*>/i
];

export function insertInHead(
  html: string,
  markup: string
): string {
  const anchor = kAnchors.find((pattern) => pattern.test(html));

  return anchor === undefined ?
    markup + html :
    html.replace(anchor, (tag) => tag + markup);
}
