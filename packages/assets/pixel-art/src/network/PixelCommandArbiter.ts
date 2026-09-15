// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";
import {
  DEFAULT_UV_SLOTS,
  isUVRegionData,
  uvTargetKey,
  type PixelBuffer,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { PixelNetworkCommand } from "./types.ts";

export type PixelStrokeCommand = Extract<
  PixelNetworkCommand,
  { action: "stroke"; }
>;
export type PixelSelectEditCommand = Extract<
  PixelNetworkCommand,
  { action: "select-edit"; }
>;
export type PixelUvRegionCommand = Extract<
  PixelNetworkCommand,
  { action: "uv-region-moved" | "uv-region-deleted" | "uv-region-state-changed"; }
>;

function uvConflictKeys(
  command: PixelUvRegionCommand,
  buffer: PixelBuffer
): string[] {
  if (command.action === "uv-region-moved") {
    return [
      uvTargetKey({
        regionId: command.metadata.id,
        slot: command.metadata.face
      })
    ];
  }

  if (command.action === "uv-region-deleted") {
    const { id } = command.metadata;
    const slots = buffer.uvRegions.get(id)?.slots ?? DEFAULT_UV_SLOTS;

    return [
      uvTargetKey({ regionId: id, slot: null }),
      ...slots.map((slot) => uvTargetKey({ regionId: id, slot }))
    ];
  }

  const { region } = command.metadata;
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
    command: PixelNetworkCommand
  ): network.Admission<PixelNetworkCommand> | null {
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
      case "uv-region-moved":
      case "uv-region-deleted":
        return this.#admitUvRegion(buffer, command);
      case "resized":
      case "texture-replaced":
        return buffer.acceptsSize(command.metadata.size) ?
          this.#regionTracker.admit(command, []) :
          null;
      default:
        return this.#regionTracker.admit(command, []);
    }
  }

  #admitStroke(
    command: PixelStrokeCommand
  ): network.Admission<PixelNetworkCommand> | null {
    const { indices, commit } = this.#admitPositions(command);
    if (indices.length === 0) {
      return null;
    }

    return {
      command: {
        ...command,
        metadata: {
          ...command.metadata,
          positions: indices.map((index) => command.metadata.positions[index])
        }
      },
      commit
    };
  }

  #admitSelectEdit(
    command: PixelSelectEditCommand
  ): network.Admission<PixelNetworkCommand> | null {
    const { metadata } = command;
    if (metadata.positions.length !== metadata.colors.length) {
      return null;
    }

    const { indices, commit } = this.#admitPositions(command);
    if (indices.length === 0) {
      return null;
    }

    return {
      command: {
        ...command,
        metadata: {
          positions: indices.map((index) => metadata.positions[index]),
          colors: indices.map((index) => metadata.colors[index])
        }
      },
      commit
    };
  }

  #admitPositions(
    command: PixelStrokeCommand | PixelSelectEditCommand
  ): network.PartialAdmission {
    return this.#pixelTracker.admitEach(
      command,
      command.metadata.positions.map(pixelKey)
    );
  }

  #admitUvRegion(
    buffer: PixelBuffer,
    command: PixelUvRegionCommand
  ): network.Admission<PixelNetworkCommand> | null {
    return this.#regionTracker.admit(
      command,
      uvConflictKeys(command, buffer)
    );
  }
}

function pixelKey(
  position: Vec2
): string {
  return `${position.x},${position.y}`;
}
