// Import Internal Dependencies
import { Line } from "./Line.ts";
import type {
  Brush,
  BrushPaintSource
} from "./Brush.ts";
import type { PixelDocument } from "../PixelDocument.ts";
import type { LinePreview } from "../rendering/overlays/LinePreview.ts";
import { positionKey } from "../utils/math.ts";
import type {
  PeerStrokePixel,
  Vec2
} from "../types.ts";

export type LineCommitTrigger = "mousedown" | "mouseup";

interface PendingLine {
  start: Vec2;
  end: Vec2;
  trigger: LineCommitTrigger;
  source: BrushPaintSource;
}

export interface LineEngineOptions {
  brush: Brush;
  linePreview: LinePreview;
  document: Pick<PixelDocument, "paintPixels">;
  onProgress?: (pixels: PeerStrokePixel[]) => void;
}

export class LineEngine {
  #brush: Brush;
  #linePreview: LinePreview;
  #document: Pick<PixelDocument, "paintPixels">;
  #onProgress?: (pixels: PeerStrokePixel[]) => void;

  #cursor: Vec2 | null = null;
  #pending: PendingLine | null = null;

  constructor(
    options: LineEngineOptions
  ) {
    this.#brush = options.brush;
    this.#linePreview = options.linePreview;
    this.#document = options.document;
    this.#onProgress = options.onProgress;
  }

  commitsOn(
    trigger: LineCommitTrigger
  ): boolean {
    return this.#pending?.trigger === trigger;
  }

  updateCursor(
    position: Vec2 | null
  ): void {
    this.#cursor = position;
    if (this.#pending && position) {
      this.#pending.end = position;
      this.refreshPreview();
    }
  }

  arm(
    trigger: LineCommitTrigger,
    source: BrushPaintSource
  ): void {
    if (this.#cursor) {
      this.#armAt(this.#cursor, trigger, source);
    }
  }

  commit(
    source?: BrushPaintSource
  ): void {
    const pending = this.#pending;
    if (pending === null) {
      return;
    }

    const lineSource = source ?? pending.source;
    this.#linePreview.clear();
    this.#document.paintPixels(
      this.#stamp(pending),
      this.#brush.colorFor(lineSource)
    );
    this.#onProgress?.([]);
    this.#armAt(pending.end, "mousedown", lineSource);
  }

  cancel(): void {
    if (this.#pending === null) {
      return;
    }

    this.#pending = null;
    this.#linePreview.clear();
    this.#onProgress?.([]);
  }

  refreshPreview(): void {
    const pending = this.#pending;
    if (pending === null) {
      return;
    }

    this.#linePreview.drawLine(pending.start, pending.end);

    const color = this.#brush.colorFor(pending.source);
    this.#onProgress?.(
      this.#stamp(pending).map((position) => {
        return { ...position, color };
      })
    );
  }

  #armAt(
    start: Vec2,
    trigger: LineCommitTrigger,
    source: BrushPaintSource
  ): void {
    this.#pending = {
      start,
      end: start,
      trigger,
      source
    };
    this.refreshPreview();
  }

  #stamp(
    line: PendingLine
  ): Vec2[] {
    const stamped = new Map<string, Vec2>();
    for (const point of Line.rasterize(line.start, line.end)) {
      for (const pixel of this.#brush.affectedPixels(point.x, point.y)) {
        stamped.set(positionKey(pixel), pixel);
      }
    }

    return [...stamped.values()];
  }
}
