// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type {
  VoxelNetworkCommand,
  VoxelServerMessage
} from "@jolly-pixel/asset.voxel-map/network/client.ts";
import { PeerMarkTracker } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type { BrushStore, PresenceStore } from "../../../state/index.ts";
import { PRESENCE_KEYS } from "../../../collaboration/presenceKeys.ts";

export interface BlockSelectionPresenceOptions {
  room: network.Room<
    VoxelNetworkCommand,
    VoxelServerMessage
  >;
  brush: BrushStore;
  presence: PresenceStore;
}

export class BlockSelectionPresence {
  #brush: BrushStore;
  #presence: PresenceStore;
  #tracker: PeerMarkTracker<number>;
  #unsubscribeBlock: () => void;

  #onBlockChange = (): void => {
    this.#tracker.publishLocal();
  };

  constructor(
    options: BlockSelectionPresenceOptions
  ) {
    this.#brush = options.brush;
    this.#presence = options.presence;

    this.#tracker = new PeerMarkTracker({
      room: options.room,
      presenceKey: PRESENCE_KEYS.block,
      localKey: () => this.#brush.blockId,
      readKey: readBlockId,
      publish: (marks) => {
        this.#presence.blockSelections = marks;
      }
    });
    this.#unsubscribeBlock = this.#brush.subscribe(
      "blockChange",
      this.#onBlockChange
    );
  }

  dispose(): void {
    this.#unsubscribeBlock();
    this.#tracker.dispose();
  }
}

function readBlockId(
  value: unknown
): number | null {
  return typeof value === "number" && Number.isInteger(value)
    ? value
    : null;
}
