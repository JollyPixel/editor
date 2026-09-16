// Import Third-party Dependencies
import type {
  Mode,
  PixelArtCanvas
} from "@jolly-pixel/pixel-draw.renderer";

// CONSTANTS
const kToolOptionModes = {
  pickColor: "paint",
  fillGlobal: "fill",
  fillUvClip: "fill",
  selectShape: "select"
} as const satisfies Record<string, Mode>;

export type ToolOptionName = keyof typeof kToolOptionModes;

export type ToolOptions = Record<ToolOptionName, boolean>;

export interface ToolOption {
  name: ToolOptionName;
  value: boolean;
}

export const DEFAULT_TOOL_OPTIONS: Readonly<ToolOptions> = {
  pickColor: false,
  fillGlobal: false,
  fillUvClip: false,
  selectShape: false
};

export function readToolOptions(
  canvas: PixelArtCanvas
): ToolOptions {
  const { brush, fill, select } = canvas.tools;

  return {
    pickColor: brush.pickArmed,
    fillGlobal: fill.global,
    fillUvClip: fill.uvClip,
    selectShape: select.shape
  };
}

export function writeToolOptions(
  canvas: PixelArtCanvas,
  options: Readonly<ToolOptions>
): void {
  const { brush, fill, select } = canvas.tools;

  brush.pickArmed = canvas.mode === "paint" && options.pickColor;
  fill.global = options.fillGlobal;
  fill.uvClip = options.fillUvClip;
  select.shape = options.selectShape;
}

export function applyToolOption(
  canvas: PixelArtCanvas,
  option: ToolOption
): void {
  canvas.mode = kToolOptionModes[option.name];
  writeToolOptions(canvas, {
    ...readToolOptions(canvas),
    [option.name]: option.value
  });
}
