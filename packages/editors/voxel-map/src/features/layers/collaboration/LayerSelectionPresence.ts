// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type {
  VoxelNetworkCommand,
  VoxelServerMessage
} from "@jolly-pixel/asset.voxel-map/network/client.ts";
import { PeerMarkTracker } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type { PresenceStore, SelectionStore } from "../../../state/index.ts";
import { PRESENCE_KEYS } from "../../../collaboration/presenceKeys.ts";
import {
  layerPresenceKey,
  readLayerPresenceKey
} from "./layerPresenceKey.ts";

export interface LayerSelectionPresenceOptions {
  room: network.Room<
    VoxelNetworkCommand,
    VoxelServerMessage
  >;
  selection: SelectionStore;
  presence: PresenceStore;
}

export class LayerSelectionPresence {
  #selection: SelectionStore;
  #presence: PresenceStore;
  #tracker: PeerMarkTracker<string>;
  #unsubscribeSelection: () => void;

  #onSelectionChange = (): void => {
    this.#tracker.publishLocal();
  };

  constructor(
    options: LayerSelectionPresenceOptions
  ) {
    this.#selection = options.selection;
    this.#presence = options.presence;

    this.#tracker = new PeerMarkTracker({
      room: options.room,
      presenceKey: PRESENCE_KEYS.layer,
      localKey: () => layerPresenceKey(this.#selection.current),
      readKey: readLayerPresenceKey,
      publish: (marks) => {
        this.#presence.layerSelections = marks;
      }
    });
    this.#unsubscribeSelection = this.#selection.subscribe(
      "change",
      this.#onSelectionChange
    );
  }

  dispose(): void {
    this.#unsubscribeSelection();
    this.#tracker.dispose();
  }
}
