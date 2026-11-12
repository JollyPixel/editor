// Import Third-party Dependencies
import { PeerMarkTracker } from "@jolly-pixel/ui/network";
import { decodeString } from "@jolly-pixel/network/client";
import {
  VOXEL_MODEL_PRESENCE_KEYS,
  type VoxelModelRoom
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import type {
  MaterialFocusStore,
  PresenceStore
} from "../../../state/index.ts";

export interface MaterialEditPresenceOptions {
  room: VoxelModelRoom;
  focus: MaterialFocusStore;
  presence: PresenceStore;
}

export class MaterialEditPresence {
  #tracker: PeerMarkTracker<string>;

  constructor(
    options: MaterialEditPresenceOptions
  ) {
    const { focus, presence } = options;
    this.#tracker = new PeerMarkTracker({
      room: options.room,
      presenceKey: VOXEL_MODEL_PRESENCE_KEYS.materialEdit,
      decode: decodeString,
      local: {
        read: () => focus.edited,
        subscribe: (listener) => focus.subscribe("edit", listener)
      },
      publish: (marks) => {
        presence.materialEdits = marks;
      }
    });
  }

  dispose(): void {
    this.#tracker.dispose();
  }
}
