// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";
import { PixelCommandArbiter } from "@jolly-pixel/asset.pixel-art/network/server.ts";
import type { PixelBuffer } from "@jolly-pixel/pixel-draw.renderer";
import { localBlock } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  isPixelNetworkCommand,
  type TilesetDocumentNetworkCommand,
  type TilesetNetworkCommand
} from "./types.ts";

export interface TilesetCommandArbiterOptions {
  conflictResolver?: network.ConflictResolver;
}

export interface TilesetArbiterState {
  readonly pixels: PixelBuffer;
}

/**
 * Pixel commands are arbitrated per pixel and UV region as in a pixel-art
 * room; document commands collide per block, material group or tile size.
 */
export class TilesetCommandArbiter {
  #pixels: PixelCommandArbiter;
  #tracker: network.ConflictTracker;

  constructor(
    options: TilesetCommandArbiterOptions = {}
  ) {
    const resolver = options.conflictResolver ??
      new network.LastWriteWinsResolver();
    this.#pixels = new PixelCommandArbiter({
      conflictResolver: resolver
    });
    this.#tracker = new network.ConflictTracker(resolver);
  }

  admit(
    state: TilesetArbiterState,
    command: TilesetNetworkCommand
  ): network.Admission<TilesetNetworkCommand> | null {
    if (isPixelNetworkCommand(command)) {
      return this.#pixels.admit(state.pixels, command);
    }
    if (!isFoldable(command)) {
      return null;
    }

    return this.#tracker.admit(
      command,
      [TilesetCommandArbiter.key(command)]
    );
  }

  static key(
    command: TilesetDocumentNetworkCommand
  ): string {
    switch (command.action) {
      case "block-defined":
        return `block:${command.block.id}`;
      case "block-removed":
      case "block-moved":
        return `block:${command.blockId}`;
      case "material-group-defined":
        return `material-group:${command.group.id}`;
      case "material-group-removed":
        return `material-group:${command.groupId}`;
      case "tile-size-updated":
        return "tile-size";
      default: {
        const unhandled: never = command;
        throw new Error(
          `TilesetCommandArbiter: unhandled action '${(unhandled as TilesetDocumentNetworkCommand).action}'.`
        );
      }
    }
  }
}

function isFoldable(
  command: TilesetDocumentNetworkCommand
): boolean {
  if (command.action !== "block-defined") {
    return true;
  }

  try {
    localBlock(command.block);

    return true;
  }
  catch {
    return false;
  }
}
