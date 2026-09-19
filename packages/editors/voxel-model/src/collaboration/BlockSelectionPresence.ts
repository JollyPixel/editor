// Import Third-party Dependencies
import { PeerMarkTracker } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type { ModelBlocks } from "../model/index.ts";
import type { PresenceStore } from "../state/index.ts";
import { PRESENCE_KEYS } from "./presenceKeys.ts";
import type { VoxelModelRoom } from "./types.ts";

export interface BlockSelectionPresenceOptions {
  room: VoxelModelRoom;
  blocks: ModelBlocks;
  presence: PresenceStore;
}

export class BlockSelectionPresence {
  #blocks: ModelBlocks;
  #tracker: PeerMarkTracker<string>;

  #onSelect = (): void => {
    this.#tracker.publishLocal();
  };

  constructor(
    options: BlockSelectionPresenceOptions
  ) {
    const { blocks, presence } = options;
    this.#blocks = blocks;

    this.#tracker = new PeerMarkTracker({
      room: options.room,
      presenceKey: PRESENCE_KEYS.block,
      localKey: () => blocks.selected?.uuid ?? null,
      readKey: readBlockUuid,
      publish: (marks) => {
        presence.blockSelections = marks;
      }
    });
    this.#blocks.on("select", this.#onSelect);
  }

  dispose(): void {
    this.#blocks.off("select", this.#onSelect);
    this.#tracker.dispose();
  }
}

function readBlockUuid(
  value: unknown
): string | null {
  return typeof value === "string" ? value : null;
}
