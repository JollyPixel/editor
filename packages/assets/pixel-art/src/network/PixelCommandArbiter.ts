// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";
import {
  isUVGeometry,
  isUVRegionData,
  NormalMapConfig,
  SavedUVNet,
  type PixelDocumentState
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { PixelWireCommand } from "./types.ts";
import {
  narrowPixelCommand,
  normalMapKeys,
  paintedPositions,
  paletteKey,
  pixelKey,
  uvNetKey,
  uvRegionKeys,
  uvWriteKeys
} from "./PixelCommandKeys.ts";
import { selectEditPixels } from "./PixelWireCodec.ts";

export const PIXEL_COMMAND_RULES: network.KeyedCommandArbiterOptions<
  PixelWireCommand,
  PixelDocumentState
> = {
  accepts: acceptsPixelCommand,
  writes: pixelCommandWrites,
  narrow: narrowPixelCommand
};

export class PixelCommandArbiter extends network.KeyedCommandArbiter<
  PixelWireCommand,
  PixelDocumentState
> {
  constructor() {
    super(PIXEL_COMMAND_RULES);
  }
}

function acceptsPixelCommand(
  state: PixelDocumentState,
  command: PixelWireCommand
): boolean {
  switch (command.action) {
    case "stroke":
      return paintedPositions(command)!.length > 0;
    case "select-edit": {
      const { positions, colors } = selectEditPixels(command.metadata);

      return positions.length > 0 && positions.length === colors.length;
    }
    case "uv-region-created":
    case "uv-region-state-changed":
      return isUVRegionData(command.metadata.region);
    case "uv-region-rotated":
      return isValidRotation(command);
    case "resized":
    case "texture-replaced":
      return state.buffer.acceptsSize(command.metadata.size);
    case "normal-map-toggled":
      return isValidNormalMap(command);
    case "uv-net-saved":
      return SavedUVNet.parse(command.metadata.net) !== null;
    default:
      return true;
  }
}

function pixelCommandWrites(
  command: PixelWireCommand,
  state?: PixelDocumentState
): network.ConflictWrites {
  switch (command.action) {
    case "stroke":
    case "select-edit":
      return {
        scope: "pixels",
        keys: paintedPositions(command)!.map(pixelKey)
      };
    case "global-fill":
      return {
        scope: "pixels",
        keys: state?.buffer.findPositions(command.metadata.fromColor).map(pixelKey) ?? []
      };
    case "resized":
    case "texture-replaced":
      return {
        scope: "pixels",
        reset: true
      };
    case "uv-region-created":
      return {
        scope: "uv",
        keys: []
      };
    case "uv-region-deleted": {
      const { id } = command.metadata;

      return {
        scope: "uv",
        keys: uvRegionKeys(id, state?.uv.get(id)?.slots)
      };
    }
    case "uv-region-moved":
    case "uv-region-rotated":
    case "uv-region-state-changed":
      return {
        scope: "uv",
        keys: uvWriteKeys(command)
      };
    case "palette-color-changed":
      return {
        scope: "palette",
        keys: [paletteKey(command.metadata.index)]
      };
    case "uv-net-saved":
    case "uv-net-deleted":
    case "uv-net-default-changed":
      return {
        scope: "uv-nets",
        keys: [uvNetKey(command)]
      };
    case "normal-map-toggled":
      return {
        scope: "normal-map",
        reset: true
      };
    case "normal-map-defaults-patched":
    case "normal-map-zone-set":
    case "normal-map-zone-deleted":
      return {
        scope: "normal-map",
        keys: normalMapKeys(command)
      };
  }
}

function isValidNormalMap(
  command: Extract<PixelWireCommand, { action: "normal-map-toggled"; }>
): boolean {
  const { config } = command.metadata;

  return config === null || NormalMapConfig.parse(config) !== null;
}

function isValidRotation(
  command: Extract<PixelWireCommand, { action: "uv-region-rotated"; }>
): boolean {
  const rotation = command.metadata;

  return rotation.face === null ?
    isUVRegionData(rotation.region) && rotation.region.id === rotation.id :
    isUVGeometry(rotation.geometry);
}
