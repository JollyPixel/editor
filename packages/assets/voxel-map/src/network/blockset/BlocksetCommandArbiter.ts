// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";
import {
  isPixelCommand,
  PixelCommandArbiter
} from "@jolly-pixel/asset.pixel-art/server";
import type { PixelDocumentState } from "@jolly-pixel/pixel-draw.renderer";
import { localBlock } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { blocksetCommandKey } from "./BlocksetCommandKeys.ts";
import type {
  BlocksetDocumentNetworkCommand,
  BlocksetNetworkCommand
} from "./types.ts";

export interface BlocksetCommandArbiterOptions {
  conflictResolver?: network.ConflictResolver;
}

export interface BlocksetArbiterState {
  readonly pixels: PixelDocumentState;
}

export class BlocksetCommandArbiter {
  #pixels: PixelCommandArbiter;
  #tracker: network.ConflictTracker;

  constructor(
    options: BlocksetCommandArbiterOptions = {}
  ) {
    const resolver = options.conflictResolver ??
      new network.LastWriteWinsResolver();
    this.#pixels = new PixelCommandArbiter({
      conflictResolver: resolver
    });
    this.#tracker = new network.ConflictTracker(resolver);
  }

  admit(
    state: BlocksetArbiterState,
    command: BlocksetNetworkCommand
  ): network.Admission<BlocksetNetworkCommand> | null {
    if (isPixelCommand(command)) {
      return this.#pixels.admit(state.pixels, command);
    }
    if (!isFoldable(command)) {
      return null;
    }

    return this.#tracker.admit(
      command,
      [blocksetCommandKey(command)]
    );
  }

  restore(
    command: BlocksetNetworkCommand,
    version: number
  ): void {
    if (isPixelCommand(command)) {
      this.#pixels.restore(command, version);
    }
    else {
      this.#tracker.record(command, [blocksetCommandKey(command)], version);
    }
  }
}

function isFoldable(
  command: BlocksetDocumentNetworkCommand
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
