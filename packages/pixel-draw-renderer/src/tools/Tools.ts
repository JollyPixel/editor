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
import type { UVRegionLayer } from "../rendering/overlays/UVRegions.ts";
import type { CanvasBuffer } from "../buffer/CanvasBuffer.ts";
import type { CanvasRenderer } from "../rendering/CanvasRenderer.ts";
import type { EditPipeline } from "../sync/EditPipeline.ts";
import type { LinePreview } from "../rendering/overlays/LinePreview.ts";
import type { SelectionOutline } from "../rendering/overlays/SelectionOutline.ts";
import type {
  PeerStrokePixel,
  RGBA
} from "../types.ts";

export interface ToolsOptions {
  brush: Brush;
  canvasBuffer: CanvasBuffer;
  renderer: CanvasRenderer;
  linePreview: LinePreview;
  selectionOverlay: SelectionOutline;
  eraseColor: RGBA | null;
  uvMap: UVMap;
  uvOverlay: UVRegionLayer;
  pipeline: EditPipeline;
  /**
   * Streams brush and line pixels; selection geometry uses its own emitter.
   */
  onProgress?: (pixels: PeerStrokePixel[]) => void;
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
      pipeline: options.pipeline,
      onProgress: options.onProgress
    });

    this.fill = new FillController({
      brush: options.brush,
      canvasBuffer: options.canvasBuffer,
      pipeline: options.pipeline
    });

    this.line = new LineController({
      brush: options.brush,
      linePreview: options.linePreview,
      pipeline: options.pipeline,
      onProgress: options.onProgress
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
