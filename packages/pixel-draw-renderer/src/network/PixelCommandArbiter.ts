// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import { UV_FACES } from "../uv/UVRegion.ts";
import type { PixelBuffer } from "../buffer/PixelBuffer.ts";
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

/**
 * Moves conflict per face; other UV commands conflict across all faces.
 */
function uvConflictKeys(
  command: PixelUvRegionCommand
): string[] {
  if (command.action === "uv-region-moved") {
    return [
      `${command.metadata.id}:${command.metadata.face ?? "*"}`
    ];
  }

  const id = command.action === "uv-region-deleted" ?
    command.metadata.id :
    command.metadata.region.id;

  return [
    `${id}:*`,
    ...UV_FACES.map((face) => `${id}:${face}`)
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

  /**
   * Returns and records the accepted subset, or `null` if none survives.
   * Reads `buffer` only to reject invalid sizes.
   */
  accept(
    buffer: PixelBuffer,
    command: PixelNetworkCommand
  ): PixelNetworkCommand | null {
    switch (command.action) {
      case "stroke":
        return this.#acceptStroke(command);
      case "select-edit":
        return this.#acceptSelectEdit(command);
      case "uv-region-moved":
      case "uv-region-deleted":
      case "uv-region-state-changed":
        return this.#acceptUvRegion(command);
      case "resized":
      case "texture-replaced":
        return buffer.acceptsSize(command.metadata.size) ? command : null;
      default:
        return command;
    }
  }

  #acceptStroke(
    command: PixelStrokeCommand
  ): PixelStrokeCommand | null {
    const accepted: PixelStrokeCommand["metadata"]["positions"] = [];

    for (const position of command.metadata.positions) {
      const key = `${position.x},${position.y}`;

      if (this.#pixelTracker.resolve(key, command) === "accept") {
        accepted.push(position);
        this.#pixelTracker.record(key, command);
      }
    }

    if (accepted.length === 0) {
      return null;
    }

    return {
      ...command,
      metadata: {
        ...command.metadata,
        positions: accepted
      }
    };
  }

  #acceptSelectEdit(
    command: PixelSelectEditCommand
  ): PixelSelectEditCommand | null {
    const acceptedPositions: PixelSelectEditCommand["metadata"]["positions"] = [];
    const acceptedColors: PixelSelectEditCommand["metadata"]["colors"] = [];

    command.metadata.positions.forEach((position, index) => {
      const key = `${position.x},${position.y}`;

      if (this.#pixelTracker.resolve(key, command) === "accept") {
        acceptedPositions.push(position);
        acceptedColors.push(
          command.metadata.colors[index]
        );
        this.#pixelTracker.record(key, command);
      }
    });

    if (acceptedPositions.length === 0) {
      return null;
    }

    return {
      ...command,
      metadata: {
        positions: acceptedPositions,
        colors: acceptedColors
      }
    };
  }

  #acceptUvRegion(
    command: PixelUvRegionCommand
  ): PixelUvRegionCommand | null {
    const keys = uvConflictKeys(command);
    const rejected = keys.some(
      (key) => this.#regionTracker.resolve(key, command) === "reject"
    );
    if (rejected) {
      return null;
    }

    for (const key of keys) {
      this.#regionTracker.record(key, command);
    }

    return command;
  }
}
