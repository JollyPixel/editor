// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import {
  isPixelCommand,
  narrowPixelCommand,
  PIXEL_COMMAND_RULES
} from "@jolly-pixel/asset.pixel-art/server";
import type { PixelDocumentState } from "@jolly-pixel/pixel-draw.renderer";
import { localBlock } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { blocksetCommandKey } from "./BlocksetCommandKeys.ts";
import type {
  BlocksetDocumentNetworkCommand,
  BlocksetNetworkCommand
} from "./types.ts";

export interface BlocksetArbiterState {
  readonly pixels: PixelDocumentState;
}

export const BLOCKSET_COMMAND_RULES: network.KeyedCommandArbiterOptions<
  BlocksetNetworkCommand,
  BlocksetArbiterState
> = {
  accepts: (state, command) => (isPixelCommand(command) ?
    PIXEL_COMMAND_RULES.accepts(state.pixels, command) :
    isFoldable(command)),
  writes: (command, state) => (isPixelCommand(command) ?
    PIXEL_COMMAND_RULES.writes(command, state?.pixels) :
    {
      scope: "blockset",
      keys: [blocksetCommandKey(command)]
    }),
  narrow: (command, keep) => (isPixelCommand(command) ?
    narrowPixelCommand(command, keep) :
    null)
};

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
