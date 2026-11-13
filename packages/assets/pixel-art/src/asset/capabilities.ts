// Import Third-party Dependencies
import { defineCapabilities } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { PixelCommandAction } from "../network/protocol/pixelCommandActions.ts";

// CONSTANTS
export const PIXEL_ART_CAPABILITIES = defineCapabilities<PixelCommandAction>()([
  {
    name: "pixels",
    label: "Pixels",
    events: [
      "stroke",
      "resized",
      "texture-replaced",
      "global-fill",
      "select-edit"
    ]
  },
  {
    name: "uvStructure",
    label: "UV regions",
    events: [
      "uv-region-created",
      "uv-region-deleted"
    ]
  },
  {
    name: "uv",
    label: "UV layout",
    events: [
      "uv-region-moved",
      "uv-region-state-changed",
      "uv-region-rotated",
      "uv-region-mirrored",
      "uv-net-saved",
      "uv-net-deleted",
      "uv-net-default-changed"
    ]
  },
  {
    name: "palette",
    label: "Palette",
    events: [
      "palette-color-changed",
      "palette-replaced"
    ]
  },
  {
    name: "normalMap",
    label: "Normal map",
    events: [
      "normal-map-toggled",
      "normal-map-defaults-patched",
      "normal-map-zone-set",
      "normal-map-zone-deleted"
    ]
  }
]);
