// Import Third-party Dependencies
import type {
  Mode,
  PixelArtCanvas
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { PixelArtAccess } from "./PixelArtAccess.ts";

// CONSTANTS
const kUvAccessLevels: ReadonlySet<string> = new Set([
  "edit",
  "view",
  "none"
]);

export type UvAccess = "edit" | "view" | "none";

export class TextureAccess {
  static isUvAccess(
    value: string
  ): value is UvAccess {
    return kUvAccessLevels.has(value);
  }

  readonly uvMode: boolean;
  readonly uvStructure: boolean;
  readonly regionVisibility: boolean;
  readonly fillClip: boolean;
  readonly pixels: boolean;
  readonly palette: boolean;
  readonly normalMap: boolean;
  readonly viewOnly: boolean;

  constructor(
    uvAccess: UvAccess,
    grants: PixelArtAccess
  ) {
    this.uvMode = uvAccess === "edit" && grants.has("uv");
    this.uvStructure = this.uvMode && grants.has("uvStructure");
    this.regionVisibility = uvAccess !== "none";
    this.fillClip = uvAccess !== "none";
    this.pixels = grants.has("pixels");
    this.palette = grants.has("palette");
    this.normalMap = grants.has("normalMap");
    this.viewOnly = grants.readOnly;

    Object.freeze(this);
  }

  constrain(
    mode: Mode
  ): Mode {
    return mode === "uv" && !this.uvMode ? "paint" : mode;
  }

  applyTo(
    canvas: PixelArtCanvas
  ): void {
    canvas.mode = this.constrain(canvas.mode);
    if (!this.fillClip) {
      canvas.tools.fill.uvClip = false;
    }
    canvas.pixelsLocked = !this.pixels;
  }
}
