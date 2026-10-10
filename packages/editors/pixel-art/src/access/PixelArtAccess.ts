// Import Third-party Dependencies
import type { PixelCommandAction } from "@jolly-pixel/asset.pixel-art/client";
import type { Right } from "@jolly-pixel/network/client";

// CONSTANTS
const kCapabilities: {
  readonly [TAction in PixelCommandAction]: PixelArtCapability;
} = {
  stroke: "pixels",
  resized: "pixels",
  "texture-replaced": "pixels",
  "global-fill": "pixels",
  "select-edit": "pixels",
  "uv-region-created": "uvStructure",
  "uv-region-deleted": "uvStructure",
  "uv-region-moved": "uv",
  "uv-region-state-changed": "uv",
  "uv-region-rotated": "uv",
  "palette-color-changed": "palette",
  "normal-map-toggled": "normalMap",
  "normal-map-defaults-patched": "normalMap",
  "normal-map-zone-set": "normalMap",
  "normal-map-zone-deleted": "normalMap"
};

export type PixelArtCapability =
  | "pixels"
  | "uv"
  | "uvStructure"
  | "palette"
  | "normalMap";

export type PixelArtGrants = Readonly<Record<PixelArtCapability, boolean>>;

export interface RightsSource {
  can(
    event: string
  ): Right;
}

export class PixelArtAccess {
  static readonly full = new PixelArtAccess({
    pixels: true,
    uv: true,
    uvStructure: true,
    palette: true,
    normalMap: true
  });

  static readonly none = new PixelArtAccess({
    pixels: false,
    uv: false,
    uvStructure: false,
    palette: false,
    normalMap: false
  });

  static fromRights(
    source: RightsSource
  ): PixelArtAccess {
    const grants: Record<PixelArtCapability, boolean> = { ...PixelArtAccess.full };
    for (const [action, capability] of Object.entries(kCapabilities)) {
      if (source.can(action) !== "write") {
        grants[capability] = false;
      }
    }

    return new PixelArtAccess(grants);
  }

  readonly pixels: boolean;
  readonly uv: boolean;
  readonly uvStructure: boolean;
  readonly palette: boolean;
  readonly normalMap: boolean;

  constructor(
    grants: PixelArtGrants
  ) {
    this.pixels = grants.pixels;
    this.uv = grants.uv;
    this.uvStructure = grants.uvStructure;
    this.palette = grants.palette;
    this.normalMap = grants.normalMap;

    Object.freeze(this);
  }

  get viewOnly(): boolean {
    return !this.pixels &&
      !this.uv &&
      !this.uvStructure &&
      !this.palette &&
      !this.normalMap;
  }
}
