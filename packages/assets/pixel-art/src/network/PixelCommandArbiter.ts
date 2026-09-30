// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";
import {
  DEFAULT_UV_SLOTS,
  isUVGeometry,
  isUVRegionData,
  uvTargetKey,
  type PixelBuffer,
  type UVRegionData,
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

export type PixelStrokeCommand = Extract<
  PixelWireCommand,
  { action: "stroke"; }
>;
export type PixelSelectEditCommand = Extract<
  PixelWireCommand,
  { action: "select-edit"; }
>;
export type PixelReplacementCommand = Extract<
  PixelWireCommand,
  { action: "resized" | "texture-replaced"; }
>;
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

function regionConflictKeys(
  region: UVRegionData
): string[] {
  const faces = region.faces ?
    Object.keys(region.faces) :
    DEFAULT_UV_SLOTS;

  return [
    uvTargetKey({ regionId: region.id, slot: null }),
    ...faces.map((face) => uvTargetKey({
      regionId: region.id,
      slot: face
    }))
  ];
}

function uvConflictKeys(
  command: PixelUvRegionCommand,
  buffer: PixelBuffer
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
        regionConflictKeys(rotation.region) :
        [uvTargetKey({ regionId: rotation.id, slot: rotation.face })];
    }
    case "uv-region-deleted": {
      const { id } = command.metadata;
      const slots = buffer.uvRegions.get(id)?.slots ?? DEFAULT_UV_SLOTS;

      return [
        uvTargetKey({ regionId: id, slot: null }),
        ...slots.map((slot) => uvTargetKey({ regionId: id, slot }))
      ];
    }
    default:
      return regionConflictKeys(command.metadata.region);
  }
}

export interface PixelCommandArbiterOptions {
  conflictResolver?: network.ConflictResolver;
}

export class PixelCommandArbiter {
  #pixelTracker: network.ConflictTracker;
  #regionTracker: network.ConflictTracker;

  constructor(
    options: PixelCommandArbiterOptions = {}
  ) {
    const resolver = options.conflictResolver ??
      new network.LastWriteWinsResolver();
    this.#pixelTracker = new network.ConflictTracker(resolver);
    this.#regionTracker = new network.ConflictTracker(resolver);
  }

  admit(
    buffer: PixelBuffer,
    command: PixelWireCommand
  ): network.Admission<PixelWireCommand> | null {
    switch (command.action) {
      case "stroke":
        return this.#admitStroke(command);
      case "select-edit":
        return this.#admitSelectEdit(command);
      case "uv-region-created":
        return isUVRegionData(command.metadata.region) ?
          this.#regionTracker.admit(command, []) :
          null;
      case "uv-region-state-changed":
        return isUVRegionData(command.metadata.region) ?
          this.#admitUvRegion(buffer, command) :
          null;
      case "uv-region-rotated":
        return isValidRotation(command) ?
          this.#admitUvRegion(buffer, command) :
          null;
      case "uv-region-moved":
      case "uv-region-deleted":
        return this.#admitUvRegion(buffer, command);
      case "resized":
      case "texture-replaced":
        return buffer.acceptsSize(command.metadata.size) ?
          this.#admitReplacement(command) :
          null;
      case "global-fill":
        return this.#regionTracker.admit(command, []);
    }
  }

  #admitStroke(
    command: PixelStrokeCommand
  ): network.Admission<PixelWireCommand> | null {
    const positions = strokePositions(command.metadata);
    const { indices, commit } = this.#admitPositions(
      command,
      positions
    );
    if (indices.length === 0) {
      return null;
    }
    if (indices.length === positions.length) {
      return {
        command,
        commit
      };
    }

    return {
      command: {
        ...command,
        metadata: {
          color: command.metadata.color,
          xy: packPositions(indices.map((index) => positions[index]))
        }
      },
      commit
    };
  }

  #admitSelectEdit(
    command: PixelSelectEditCommand
  ): network.Admission<PixelWireCommand> | null {
    const { positions, colors } = selectEditPixels(command.metadata);
    if (positions.length !== colors.length) {
      return null;
    }

    const { indices, commit } = this.#admitPositions(
      command,
      positions
    );
    if (indices.length === 0) {
      return null;
    }
    if (indices.length === positions.length) {
      return {
        command,
        commit
      };
    }

    return {
      command: {
        ...command,
        metadata: {
          xy: packPositions(indices.map((index) => positions[index])),
          rgba: packColors(indices.map((index) => colors[index]))
        }
      },
      commit
    };
  }

  #admitReplacement(
    command: PixelReplacementCommand
  ): network.Admission<PixelWireCommand> {
    return {
      command,
      commit: () => this.#pixelTracker.reset(command)
    };
  }

  #admitPositions(
    command: PixelWireCommand,
    positions: readonly Vec2[]
  ): network.PartialAdmission {
    return this.#pixelTracker.admitEach(
      command,
      positions.map(pixelKey)
    );
  }

  #admitUvRegion(
    buffer: PixelBuffer,
    command: PixelUvRegionCommand
  ): network.Admission<PixelWireCommand> | null {
    return this.#regionTracker.admit(
      command,
      uvConflictKeys(command, buffer)
    );
  }
}

function isValidRotation(
  command: Extract<PixelWireCommand, { action: "uv-region-rotated"; }>
): boolean {
  const rotation = command.metadata;

  return rotation.face === null ?
    isUVRegionData(rotation.region) && rotation.region.id === rotation.id :
    isUVGeometry(rotation.geometry);
}

function pixelKey(
  position: Vec2
): string {
  return `${position.x},${position.y}`;
}
