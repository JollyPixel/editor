// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";
import {
  DEFAULT_UV_SLOTS,
  Fill,
  isUVGeometry,
  isUVRegionData,
  type PixelBuffer
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { PixelWireCommand } from "./types.ts";
import {
  narrowPixelCommand,
  paintedPositions,
  pixelKey,
  uvRegionKeys,
  uvWriteKeys,
  type PixelUvRegionCommand
} from "./PixelCommandKeys.ts";
import { selectEditPixels } from "./PixelWireCodec.ts";

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

function uvConflictKeys(
  command: PixelUvRegionCommand,
  buffer: PixelBuffer
): string[] {
  if (command.action !== "uv-region-deleted") {
    return uvWriteKeys(command);
  }

  const { id } = command.metadata;

  return uvRegionKeys(id, buffer.uvRegions.get(id)?.slots ?? DEFAULT_UV_SLOTS);
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
        return this.#admitPixels(command);
      case "select-edit": {
        const { positions, colors } = selectEditPixels(command.metadata);

        return positions.length === colors.length ?
          this.#admitPixels(command) :
          null;
      }
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
        return this.#pixelTracker.admit(
          command,
          Fill.matchAll(buffer, command.metadata.fromColor).map(pixelKey)
        );
    }
  }

  restore(
    command: PixelWireCommand,
    version: number
  ): void {
    switch (command.action) {
      case "stroke":
      case "select-edit":
        this.#pixelTracker.record(
          command,
          paintedPositions(command)!.map(pixelKey),
          version
        );
        break;
      case "resized":
      case "texture-replaced":
        this.#pixelTracker.reset(command, version);
        break;
      case "uv-region-moved":
      case "uv-region-rotated":
      case "uv-region-state-changed":
        this.#regionTracker.record(command, uvWriteKeys(command), version);
        break;
      case "uv-region-deleted":
        this.#regionTracker.record(
          command,
          uvRegionKeys(command.metadata.id),
          version
        );
        break;
      default:
        break;
    }
  }

  #admitPixels(
    command: PixelStrokeCommand | PixelSelectEditCommand
  ): network.Admission<PixelWireCommand> | null {
    const keys = paintedPositions(command)!.map(pixelKey);
    const { indices, commit } = this.#pixelTracker.admitEach(command, keys);
    if (indices.length === 0) {
      return null;
    }
    if (indices.length === keys.length) {
      return {
        command,
        commit
      };
    }

    return {
      command: narrowPixelCommand(command, indices)!,
      commit
    };
  }

  #admitReplacement(
    command: PixelReplacementCommand
  ): network.Admission<PixelWireCommand> {
    return {
      command,
      commit: (version) => this.#pixelTracker.reset(command, version)
    };
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
