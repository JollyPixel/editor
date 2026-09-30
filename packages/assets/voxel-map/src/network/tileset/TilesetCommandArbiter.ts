// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";
import {
  isPixelCommand,
  PixelCommandArbiter
} from "@jolly-pixel/asset.pixel-art/server";
import type { PixelBuffer } from "@jolly-pixel/pixel-draw.renderer";
import { localBlock } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { tilesetCommandKey } from "./TilesetCommandKeys.ts";
import type {
  TilesetDocumentNetworkCommand,
  TilesetNetworkCommand
} from "./types.ts";

export interface TilesetCommandArbiterOptions {
  conflictResolver?: network.ConflictResolver;
}

export interface TilesetArbiterState {
  readonly pixels: PixelBuffer;
}

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
    if (isPixelCommand(command)) {
      return this.#pixels.admit(state.pixels, command);
    }
    if (!isFoldable(command)) {
      return null;
    }

    return this.#tracker.admit(
      command,
      [tilesetCommandKey(command)]
    );
  }

  restore(
    command: TilesetNetworkCommand,
    version: number
  ): void {
    if (isPixelCommand(command)) {
      this.#pixels.restore(command, version);
    }
    else {
      this.#tracker.record(command, [tilesetCommandKey(command)], version);
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
