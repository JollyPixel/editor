// Import Internal Dependencies
import type { Brush } from "./Brush.ts";
import {
  BrushEngine,
  type BrushTool
} from "./BrushEngine.ts";
import {
  FillEngine,
  type FillTool
} from "./FillEngine.ts";
import {
  LineEngine
} from "./LineEngine.ts";
import {
  SelectEngine,
  type SelectTool
} from "./SelectEngine.ts";
import {
  UVController,
  type UVTool
} from "./uv/UVController.ts";
import type { ScreenProjection } from "../rendering/Viewport.ts";
import type { UVRegionLayer } from "../rendering/overlays/UVRegions.ts";
import type { CanvasRenderer } from "../rendering/CanvasRenderer.ts";
import type { PixelDocument } from "../PixelDocument.ts";
import type { SelectionEdit } from "../sync/LocalEdit.types.ts";
import type { LinePreview } from "../rendering/overlays/LinePreview.ts";
import type { SelectionOutline } from "../rendering/overlays/SelectionOutline.ts";
import type { SelectionEraseColor } from "../selection/SelectionEraseColor.ts";
import type {
  PeerStrokePixel
} from "../types.ts";

export interface ToolsOptions {
  brush: Brush;
  document: PixelDocument;
  renderer: CanvasRenderer;
  linePreview: LinePreview;
  selectionOverlay: SelectionOutline;
  eraseColor: SelectionEraseColor;
  uvOverlay: UVRegionLayer;
  uvDeselectOnEmptyClick?: boolean;
  uvResizable?: boolean;
  viewport: ScreenProjection;
  onProgress?: (pixels: PeerStrokePixel[]) => void;
  paintSelectionEdit?: (edit: SelectionEdit) => void;
}

export interface Toolset {
  brush: BrushTool;
  fill: FillTool;
  select: SelectTool;
  uv: UVTool;
}

export class Tools {
  readonly brush: BrushEngine;
  readonly fill: FillEngine;
  readonly line: LineEngine;
  readonly select: SelectEngine;
  readonly uv: UVController;

  constructor(
    options: ToolsOptions
  ) {
    const { document } = options;

    this.brush = new BrushEngine({
      brush: options.brush,
      document,
      canvas: options.renderer.canvas(),
      onProgress: options.onProgress
    });

    this.fill = new FillEngine({
      brush: options.brush,
      document
    });

    this.line = new LineEngine({
      brush: options.brush,
      linePreview: options.linePreview,
      document,
      onProgress: options.onProgress
    });

    const { paintSelectionEdit = (edit) => document.paintSelectionEdit(edit) } = options;
    this.select = new SelectEngine({
      document: {
        buffer: document.buffer,
        paintSelectionEdit
      },
      floatingSelection: options.renderer.floatingSelection,
      selectionOverlay: options.selectionOverlay,
      eraseColor: options.eraseColor,
      viewport: options.viewport
    });

    this.uv = new UVController({
      uvMap: document.uv,
      overlay: options.uvOverlay,
      deselectOnEmptyClick: options.uvDeselectOnEmptyClick,
      resizable: options.uvResizable,
      viewport: options.viewport
    });
  }
}
