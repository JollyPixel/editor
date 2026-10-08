// Import Third-party Dependencies
import {
  ChangeSourceAdapter,
  type ChangeSource
} from "@jolly-pixel/history";
import type { DocumentCommand } from "@jolly-pixel/pixel-draw.renderer";

// CONSTANTS
const kEdits = new WeakMap<ChangeSource<DocumentCommand>, PixelEdits>();

export type PixelEdits = ChangeSourceAdapter<DocumentCommand>;

export function pixelEdits(
  document: ChangeSource<DocumentCommand>
): PixelEdits {
  let edits = kEdits.get(document);
  if (edits === undefined) {
    edits = new ChangeSourceAdapter(document);
    kEdits.set(document, edits);
  }

  return edits;
}
