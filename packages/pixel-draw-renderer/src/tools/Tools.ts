// Import Internal Dependencies
import type { Brush } from "./Brush.ts";
import {
  BrushController,
  type BrushTool
} from "./BrushController.ts";
import {
  FillController,
  type FillTool
} from "./FillController.ts";
import {
  LineController
} from "./LineController.ts";
import {
  SelectController,
  type SelectTool
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

export interface ToolsOptions {
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
 * Public view of the drawing tools (`PixelArtCanvas.tools`). `line`/`uv` are
 * internal; the UV model is on `PixelArtCanvas.uv`.
 */
export interface Toolset {
  brush: BrushTool;
  fill: FillTool;
  select: SelectTool;
}

/**
 * Groups the drawing tool controllers. The concrete container behind the
 * public `Toolset` view (`PixelArtCanvas.tools`).
 */
export class Tools {
  readonly brush: BrushController;
  readonly fill: FillController;
  readonly line: LineController;
  readonly select: SelectController;
  readonly uv: UVController;

  constructor(
    options: ToolsOptions
  ) {
    this.brush = new BrushController({
      brush: options.brush,
      canvasBuffer: options.canvasBuffer,
      canvas: options.renderer.canvas(),
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
      floatingSelection: options.renderer.floatingSelection,
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
