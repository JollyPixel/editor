/**
 * Installs a document-level stylesheet once, including under server rendering.
 */
export function ensureDocumentStyles(
  id: string,
  css: string,
  ownerDocument: Document | undefined = globalThis.document
): void {
  if (
    ownerDocument === undefined ||
    ownerDocument.getElementById(id) !== null
  ) {
    return;
  }

  const style = ownerDocument.createElement("style");
  style.id = id;
  style.textContent = css;
  ownerDocument.head.append(style);
}
