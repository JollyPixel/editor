// Import Third-party Dependencies
import { PeerMarkTracker } from "@jolly-pixel/ui/network";
import type { VoxelModelRoom } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import type {
  MaterialFocusStore,
  PresenceStore
} from "../../../state/index.ts";
import { PRESENCE_KEYS } from "../../../collaboration/presenceKeys.ts";

export interface MaterialEditPresenceOptions {
  room: VoxelModelRoom;
  focus: MaterialFocusStore;
  presence: PresenceStore;
}

export class MaterialEditPresence {
  #tracker: PeerMarkTracker<string>;
  #unsubscribe: () => void;

  #onEdit = (): void => {
    this.#tracker.publishLocal();
  };

  constructor(
    options: MaterialEditPresenceOptions
  ) {
    const { focus, presence } = options;
    this.#tracker = new PeerMarkTracker({
      room: options.room,
      presenceKey: PRESENCE_KEYS.materialEdit,
      localKey: () => focus.edited,
      readKey: (value) => (typeof value === "string" ? value : null),
      publish: (marks) => {
        presence.materialEdits = marks;
      }
    });
    this.#unsubscribe = focus.subscribe("edit", this.#onEdit);
  }

  dispose(): void {
    this.#unsubscribe();
    this.#tracker.dispose();
  }
}
