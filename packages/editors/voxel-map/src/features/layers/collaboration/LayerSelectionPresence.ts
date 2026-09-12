// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type {
  VoxelNetworkCommand,
  VoxelServerMessage
} from "@jolly-pixel/voxel.renderer/network/client.ts";

// Import Internal Dependencies
import {
  editorState,
  type PresenceStore,
  type SelectionStore
} from "../../../app/state/index.ts";
import { PeerMarkTracker } from "../../../collaboration/PeerMarkTracker.ts";
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
  selection?: SelectionStore;
  presence?: PresenceStore;
}

export class LayerSelectionPresence {
  #selection: SelectionStore;
  #presence: PresenceStore;
  #tracker: PeerMarkTracker<
    string,
    VoxelNetworkCommand,
    VoxelServerMessage
  >;
  #unsubscribeSelection: () => void;

  #onSelectionChange = (): void => {
    this.#tracker.publishLocal();
  };

  constructor(
    options: LayerSelectionPresenceOptions
  ) {
    this.#selection = options.selection ?? editorState.selection;
    this.#presence = options.presence ?? editorState.presence;

    this.#tracker = new PeerMarkTracker({
      room: options.room,
      presenceKey: PRESENCE_KEYS.layer,
      localKey: () => layerPresenceKey(this.#selection.current),
      readKey: readLayerPresenceKey,
      publish: (marks) => {
        this.#presence.layerSelections = marks;
      }
    });
    this.#unsubscribeSelection = this.#selection.watch(
      "change",
      this.#onSelectionChange
    );
  }

  dispose(): void {
    this.#unsubscribeSelection();
    this.#tracker.dispose();
  }
}
