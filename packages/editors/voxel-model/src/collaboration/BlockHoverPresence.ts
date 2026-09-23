// Import Third-party Dependencies
import { PeerMarkTracker } from "@jolly-pixel/ui/network";
import type { VoxelModelRoom } from "@jolly-pixel/asset.voxel-model/network/client.ts";

// Import Internal Dependencies
import type { ModelBlocks } from "../scene/index.ts";
import type { PresenceStore } from "../state/index.ts";
import { PRESENCE_KEYS } from "./presenceKeys.ts";

export interface BlockHoverPresenceOptions {
  room: VoxelModelRoom;
  blocks: ModelBlocks;
  presence: PresenceStore;
}

export class BlockHoverPresence {
  #blocks: ModelBlocks;
  #tracker: PeerMarkTracker<string>;

  #onHover = (): void => {
    this.#tracker.publishLocal();
  };

  constructor(
    options: BlockHoverPresenceOptions
  ) {
    const { blocks, presence } = options;
    this.#blocks = blocks;

    this.#tracker = new PeerMarkTracker({
      room: options.room,
      presenceKey: PRESENCE_KEYS.blockHover,
      localKey: () => blocks.hovered?.uuid ?? null,
      readKey: readBlockUuid,
      publish: (marks) => {
        presence.blockHovers = marks;
      }
    });
    this.#blocks.on("hover", this.#onHover);
  }

  dispose(): void {
    this.#blocks.off("hover", this.#onHover);
    this.#tracker.dispose();
  }
}

function readBlockUuid(
  value: unknown
): string | null {
  return typeof value === "string" ? value : null;
}
