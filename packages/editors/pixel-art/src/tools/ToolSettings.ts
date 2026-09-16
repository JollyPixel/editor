// Import Third-party Dependencies
import type {
  Mode,
  PixelArtCanvas
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { ColorChangeDetail } from "../color/ColorSwatch.ts";
import {
  readBrushColor,
  writeBrushColor
} from "../color/brushColor.ts";
import {
  readToolOptions,
  writeToolOptions,
  type ToolOptions
} from "./toolOptions.ts";

export interface ToolSettingsInit {
  mode: Mode;
  brushSize: number;
  options: ToolOptions;
  primary: ColorChangeDetail;
  secondary: ColorChangeDetail;
}

export class ToolSettings {
  static capture(
    canvas: PixelArtCanvas
  ): ToolSettings {
    const { brush } = canvas;

    return new ToolSettings({
      mode: canvas.mode,
      brushSize: brush.size,
      options: readToolOptions(canvas),
      primary: readBrushColor(brush.primary),
      secondary: readBrushColor(brush.secondary)
    });
  }

  readonly mode: Mode;
  readonly brushSize: number;
  readonly options: Readonly<ToolOptions>;
  readonly primary: Readonly<ColorChangeDetail>;
  readonly secondary: Readonly<ColorChangeDetail>;

  constructor(
    init: ToolSettingsInit
  ) {
    this.mode = init.mode;
    this.brushSize = init.brushSize;
    this.options = Object.freeze({ ...init.options });
    this.primary = Object.freeze({ ...init.primary });
    this.secondary = Object.freeze({ ...init.secondary });
    Object.freeze(this);
  }

  applyTo(
    canvas: PixelArtCanvas
  ): void {
    const { brush } = canvas;

    canvas.mode = this.mode;
    brush.size = this.brushSize;
    writeToolOptions(canvas, this.options);
    writeBrushColor(brush.primary, this.primary);
    writeBrushColor(brush.secondary, this.secondary);
  }
}
