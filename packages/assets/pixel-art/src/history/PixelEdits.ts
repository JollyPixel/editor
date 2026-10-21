// Import Third-party Dependencies
import {
  ChangeSourceAdapter,
  type ChangeSource
} from "@jolly-pixel/history";
import type { PixelDocumentCommand } from "@jolly-pixel/pixel-draw.renderer";

// CONSTANTS
const kEdits = new WeakMap<ChangeSource<PixelDocumentCommand>, PixelEdits>();

export type PixelEdits = ChangeSourceAdapter<PixelDocumentCommand>;

export function pixelEdits(
  document: ChangeSource<PixelDocumentCommand>
): PixelEdits {
  let edits = kEdits.get(document);
  if (edits === undefined) {
    edits = new ChangeSourceAdapter(document);
    kEdits.set(document, edits);
  }

  return edits;
}
