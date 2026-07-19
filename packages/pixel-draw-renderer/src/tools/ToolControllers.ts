// Import Internal Dependencies
import type { Brush, BrushColorSlot } from "./Brush.ts";
import {
  BrushController
} from "./BrushController.ts";
import {
  FillController,
  type FillGlobalCommit
} from "./FillController.ts";
import {
  LineController
} from "./LineController.ts";
import {
  SelectController,
  type SelectEditEntry
} from "./SelectController.ts";
import type { CanvasBuffer } from "../buffer/CanvasBuffer.ts";
import type { CanvasRenderer } from "../rendering/CanvasRenderer.ts";
import type { LinePreviewOverlay } from "../rendering/overlays/LinePreviewOverlay.ts";
import type { SelectionOverlay } from "../rendering/overlays/SelectionOverlay.ts";
import type { RGBA, Vec2 } from "../types.ts";

export interface ToolControllersOptions {
  brush: Brush;
  canvasBuffer: CanvasBuffer;
  renderer: CanvasRenderer;
  linePreview: LinePreviewOverlay;
  selectionOverlay: SelectionOverlay;
  eraseColor: RGBA;
  /** Forwarded to BrushController: a completed freehand stroke. */
  onStrokeCommit: (pixels: Vec2[], color: RGBA, beforeColors: RGBA[]) => void;
  /** Forwarded to LineController: always commits in the primary color. */
  onCommitPixels: (pixels: Vec2[]) => void;
  /** Forwarded to FillController: a contiguous fill, painted with the clicked button's color slot. */
  onFillCommitPixels: (pixels: Vec2[], slot: BrushColorSlot) => void;
  onGlobalFillCommit: (commit: FillGlobalCommit) => void;
  onSelectCommit: (entry: SelectEditEntry) => void;
}

/**
 * Groups the four interaction-mode controllers (paint/fill/line/select)
 * behind one object, exposed as `brush`/`fill`/`line`/`select` so callers
 * don't repeat the "Controller" suffix.
 */
export class ToolControllers {
  readonly brush: BrushController;
  readonly fill: FillController;
  readonly line: LineController;
  readonly select: SelectController;

  constructor(
    options: ToolControllersOptions
  ) {
    this.brush = new BrushController({
      brush: options.brush,
      canvasBuffer: options.canvasBuffer,
      renderer: options.renderer,
      onCommit: options.onStrokeCommit
    });

    this.fill = new FillController({
      brush: options.brush,
      canvasBuffer: options.canvasBuffer,
      onCommit: options.onFillCommitPixels,
      onGlobalCommit: options.onGlobalFillCommit
    });

    this.line = new LineController({
      brush: options.brush,
      linePreview: options.linePreview,
      onCommit: options.onCommitPixels
    });

    this.select = new SelectController({
      canvasBuffer: options.canvasBuffer,
      renderer: options.renderer,
      selectionOverlay: options.selectionOverlay,
      eraseColor: options.eraseColor,
      onCommit: options.onSelectCommit
    });
  }
}
