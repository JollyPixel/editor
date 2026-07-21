// Import Internal Dependencies
import type { Brush } from "./Brush.ts";
import {
  BrushController
} from "./BrushController.ts";
import {
  FillController
} from "./FillController.ts";
import {
  LineController
} from "./LineController.ts";
import {
  SelectController
} from "./SelectController.ts";
import { UVController } from "../uv/UVController.ts";
import type { UVMap } from "../uv/UVMap.ts";
import type { UVOverlay } from "../rendering/overlays/UVOverlay.ts";
import type { CanvasBuffer } from "../buffer/CanvasBuffer.ts";
import type { CanvasRenderer } from "../rendering/CanvasRenderer.ts";
import type { EditPipeline } from "../sync/EditPipeline.ts";
import type { LinePreviewOverlay } from "../rendering/overlays/LinePreviewOverlay.ts";
import type { SelectionOverlay } from "../rendering/overlays/SelectionOverlay.ts";
import type { RGBA } from "../types.ts";

export interface ToolControllersOptions {
  brush: Brush;
  canvasBuffer: CanvasBuffer;
  renderer: CanvasRenderer;
  linePreview: LinePreviewOverlay;
  selectionOverlay: SelectionOverlay;
  eraseColor: RGBA | null;
  uvMap: UVMap;
  uvOverlay: UVOverlay;
  pipeline: EditPipeline;
}

/**
 * Groups drawing tool controllers.
 */
export class ToolControllers {
  readonly brush: BrushController;
  readonly fill: FillController;
  readonly line: LineController;
  readonly select: SelectController;
  readonly uv: UVController;

  constructor(
    options: ToolControllersOptions
  ) {
    this.brush = new BrushController({
      brush: options.brush,
      canvasBuffer: options.canvasBuffer,
      renderer: options.renderer,
      pipeline: options.pipeline
    });

    this.fill = new FillController({
      brush: options.brush,
      canvasBuffer: options.canvasBuffer,
      pipeline: options.pipeline
    });

    this.line = new LineController({
      brush: options.brush,
      linePreview: options.linePreview,
      pipeline: options.pipeline
    });

    this.select = new SelectController({
      canvasBuffer: options.canvasBuffer,
      renderer: options.renderer,
      selectionOverlay: options.selectionOverlay,
      eraseColor: options.eraseColor,
      pipeline: options.pipeline
    });

    this.uv = new UVController({
      uvMap: options.uvMap,
      overlay: options.uvOverlay
    });
  }
}
