// Import Third-party Dependencies
import type { PixelCommandAction } from "@jolly-pixel/asset.pixel-art/client";
import {
  CapabilityTable,
  type Grants
} from "@jolly-pixel/network/client";

export type PixelArtCapability =
  | "pixels"
  | "uv"
  | "uvStructure"
  | "palette"
  | "normalMap";

export type PixelArtAccess = Grants<PixelArtCapability>;

export const PIXEL_ART_CAPABILITIES = new CapabilityTable<
  PixelCommandAction,
  PixelArtCapability
>({
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
});
