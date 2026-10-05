// Import Third-party Dependencies
import {
  DEFAULT_UV_SLOTS,
  uvTargetKey,
  type UVRegionData,
  type UVSlot,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { PixelWireCommand } from "./types.ts";
import {
  packColors,
  packPositions,
  selectEditPixels,
  strokePositions
} from "./PixelWireCodec.ts";

export type PixelUvRegionCommand = Extract<
  PixelWireCommand,
  {
    action:
      | "uv-region-moved"
      | "uv-region-deleted"
      | "uv-region-state-changed"
      | "uv-region-rotated";
  }
>;

export type PixelUvRegionWriteCommand = Exclude<
  PixelUvRegionCommand,
  { action: "uv-region-deleted"; }
>;

export type PixelNormalMapEditCommand = Extract<
  PixelWireCommand,
  {
    action:
      | "normal-map-defaults-patched"
      | "normal-map-zone-set"
      | "normal-map-zone-deleted";
  }
>;

export function pixelKey(
  position: Vec2
): string {
  return `${position.x},${position.y}`;
}

export function paletteKey(
  index: number
): string {
  return `palette:${index}`;
}

export function paintedPositions(
  command: PixelWireCommand
): Vec2[] | null {
  switch (command.action) {
    case "stroke":
      return strokePositions(command.metadata);
    case "select-edit":
      return selectEditPixels(command.metadata).positions;
    default:
      return null;
  }
}

export function uvRegionKeys(
  regionId: string,
  slots: readonly UVSlot[] = DEFAULT_UV_SLOTS
): string[] {
  return [
    uvTargetKey({ regionId, slot: null }),
    ...slots.map((slot) => uvTargetKey({ regionId, slot }))
  ];
}

export function uvWriteKeys(
  command: PixelUvRegionWriteCommand
): string[] {
  switch (command.action) {
    case "uv-region-moved":
      return [
        uvTargetKey({
          regionId: command.metadata.id,
          slot: command.metadata.face
        })
      ];
    case "uv-region-rotated": {
      const rotation = command.metadata;

      return rotation.face === null ?
        regionDataKeys(rotation.region) :
        [uvTargetKey({ regionId: rotation.id, slot: rotation.face })];
    }
    default:
      return regionDataKeys(command.metadata.region);
  }
}

export function pixelCommandKeys(
  command: PixelWireCommand
): string[] | null {
  switch (command.action) {
    case "stroke":
    case "select-edit":
      return paintedPositions(command)!.map(pixelKey);
    case "uv-region-moved":
    case "uv-region-rotated":
    case "uv-region-state-changed":
      return uvWriteKeys(command);
    case "palette-color-changed":
      return [paletteKey(command.metadata.index)];
    case "normal-map-defaults-patched":
    case "normal-map-zone-set":
    case "normal-map-zone-deleted":
      return normalMapKeys(command);
    default:
      return null;
  }
}

export function normalMapKeys(
  command: PixelNormalMapEditCommand
): string[] {
  switch (command.action) {
    case "normal-map-defaults-patched":
      return Object.keys(command.metadata.patch).map(
        (key) => `normal-map:defaults:${key}`
      );
    case "normal-map-zone-set":
      return [`normal-map:zone:${command.metadata.zone.regionId}`];
    case "normal-map-zone-deleted":
      return [`normal-map:zone:${command.metadata.regionId}`];
  }
}

export function narrowPixelCommand(
  command: PixelWireCommand,
  keep: readonly number[]
): PixelWireCommand | null {
  switch (command.action) {
    case "stroke": {
      const positions = strokePositions(command.metadata);

      return {
        ...command,
        metadata: {
          color: command.metadata.color,
          xy: packPositions(keep.map((index) => positions[index]))
        }
      };
    }
    case "select-edit": {
      const { positions, colors } = selectEditPixels(command.metadata);

      return {
        ...command,
        metadata: {
          xy: packPositions(keep.map((index) => positions[index])),
          rgba: packColors(keep.map((index) => colors[index]))
        }
      };
    }
    default:
      return null;
  }
}

function regionDataKeys(
  region: UVRegionData
): string[] {
  return uvRegionKeys(
    region.id,
    region.faces ? Object.keys(region.faces) : DEFAULT_UV_SLOTS
  );
}
