// Import Internal Dependencies
import type { PeerCursors } from "./PeerCursors.ts";
import type { PeerFloatingSelections } from "./PeerFloatingSelections.ts";
import type { PeerSelectionOutlines } from "./PeerSelectionOutlines.ts";
import type { PeerStrokes } from "./PeerStrokes.ts";
import type { PeerUVPreview } from "./PeerUVPreview.ts";

export interface PeerPresenceOptions {
  cursors: PeerCursors;
  strokes: PeerStrokes;
  uv: PeerUVPreview;
  selectionOutlines: PeerSelectionOutlines;
  floatingSelections: PeerFloatingSelections;
}

/**
 * Groups the transient rendering state received from remote peers.
 */
export class PeerPresence {
  readonly cursors: PeerCursors;
  readonly strokes: PeerStrokes;
  readonly uv: PeerUVPreview;
  readonly selectionOutlines: PeerSelectionOutlines;
  readonly floatingSelections: PeerFloatingSelections;

  constructor(
    options: PeerPresenceOptions
  ) {
    this.cursors = options.cursors;
    this.strokes = options.strokes;
    this.uv = options.uv;
    this.selectionOutlines = options.selectionOutlines;
    this.floatingSelections = options.floatingSelections;
  }

  refresh(): void {
    this.cursors.refresh();
    this.uv.refresh();
    this.selectionOutlines.refresh();
  }

  destroy(): void {
    this.cursors.destroy();
    this.strokes.destroy();
    this.uv.destroy();
    this.selectionOutlines.destroy();
    this.floatingSelections.destroy();
  }
}
