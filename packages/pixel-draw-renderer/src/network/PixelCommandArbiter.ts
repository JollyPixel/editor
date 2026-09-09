// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import { DEFAULT_UV_SLOTS } from "../uv/UVRegion.ts";
import { uvTargetKey } from "../uv/UVTarget.ts";
import type { PixelBuffer } from "../buffer/PixelBuffer.ts";
import type { Vec2 } from "../types.ts";
import type { PixelNetworkCommand } from "./types.ts";

export type PixelStrokeCommand = Extract<
  PixelNetworkCommand,
  { action: "stroke"; }
>;
export type PixelSelectEditCommand = Extract<
  PixelNetworkCommand,
  { action: "select-edit"; }
>;
export interface PixelArbitration {
  readonly command: PixelNetworkCommand;
  commit(): void;
}

export type PixelUvRegionCommand = Extract<
  PixelNetworkCommand,
  { action: "uv-region-moved" | "uv-region-deleted" | "uv-region-state-changed"; }
>;

/**
 * Moves conflict per face; other UV commands conflict across all faces.
 */
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
  /**
   * Conflict resolver shared by the pixel and region trackers.
   * @default network.LastWriteWinsResolver
   */
  conflictResolver?: network.ConflictResolver;
}

/**
 * Resolves command conflicts without mutating the buffer.
 */
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
  ): PixelArbitration | null {
    switch (command.action) {
      case "stroke":
        return this.#admitStroke(command);
      case "select-edit":
        return this.#admitSelectEdit(command);
      case "uv-region-moved":
      case "uv-region-deleted":
      case "uv-region-state-changed":
        return this.#admitUvRegion(buffer, command);
      case "resized":
      case "texture-replaced":
        return buffer.acceptsSize(command.metadata.size) ?
          settled(command) :
          null;
      default:
        return settled(command);
    }
  }

  accept(
    buffer: PixelBuffer,
    command: PixelNetworkCommand
  ): PixelNetworkCommand | null {
    const arbitration = this.admit(buffer, command);
    if (arbitration === null) {
      return null;
    }
    arbitration.commit();

    return arbitration.command;
  }

  #admitStroke(
    command: PixelStrokeCommand
  ): PixelArbitration | null {
    const accepted: PixelStrokeCommand["metadata"]["positions"] = [];

    for (const position of command.metadata.positions) {
      if (this.#pixelTracker.resolve(pixelKey(position), command) === "accept") {
        accepted.push(position);
      }
    }

    if (accepted.length === 0) {
      return null;
    }

    return this.#pixelArbitration({
      ...command,
      metadata: {
        ...command.metadata,
        positions: accepted
      }
    }, accepted);
  }

  #admitSelectEdit(
    command: PixelSelectEditCommand
  ): PixelArbitration | null {
    const acceptedPositions: PixelSelectEditCommand["metadata"]["positions"] = [];
    const acceptedColors: PixelSelectEditCommand["metadata"]["colors"] = [];

    command.metadata.positions.forEach((position, index) => {
      if (this.#pixelTracker.resolve(pixelKey(position), command) === "accept") {
        acceptedPositions.push(position);
        acceptedColors.push(
          command.metadata.colors[index]
        );
      }
    });

    if (acceptedPositions.length === 0) {
      return null;
    }

    return this.#pixelArbitration({
      ...command,
      metadata: {
        positions: acceptedPositions,
        colors: acceptedColors
      }
    }, acceptedPositions);
  }

  #admitUvRegion(
    buffer: PixelBuffer,
    command: PixelUvRegionCommand
  ): PixelArbitration | null {
    const keys = uvConflictKeys(command, buffer);
    const rejected = keys.some(
      (key) => this.#regionTracker.resolve(key, command) === "reject"
    );
    if (rejected) {
      return null;
    }

    return {
      command,
      commit: () => {
        for (const key of keys) {
          this.#regionTracker.record(key, command);
        }
      }
    };
  }

  #pixelArbitration(
    command: PixelNetworkCommand,
    positions: readonly Vec2[]
  ): PixelArbitration {
    return {
      command,
      commit: () => {
        for (const position of positions) {
          this.#pixelTracker.record(pixelKey(position), command);
        }
      }
    };
  }
}

function pixelKey(
  position: Vec2
): string {
  return `${position.x},${position.y}`;
}

function settled(
  command: PixelNetworkCommand
): PixelArbitration {
  return {
    command,
    commit: () => void 0
  };
}
