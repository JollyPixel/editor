// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  editorState,
  type ModelEventMap,
  type PresenceStore
} from "../app/state/index.ts";
import type {
  ModelNetworkCommand,
  ModelServerMessage
} from "../network/types.ts";
import { PeerMarkTracker } from "./PeerMarkTracker.ts";
import { PRESENCE_KEYS } from "./presenceKeys.ts";

export interface GroupSelectionPresenceOptions {
  room: network.Room<ModelNetworkCommand, ModelServerMessage>;
  presence?: PresenceStore;
}

export class GroupSelectionPresence {
  #presence: PresenceStore;
  #selectedUuid: string | null = null;
  #tracker: PeerMarkTracker<string>;

  #onGroupSelected: ModelEventMap["groupSelected"] = (
    { group }
  ) => {
    this.#selectedUuid = group ? group.getGroupUUID() : null;
    this.#tracker.publishLocal();
  };

  constructor(
    options: GroupSelectionPresenceOptions
  ) {
    this.#presence = options.presence ?? editorState.presence;

    this.#tracker = new PeerMarkTracker({
      room: options.room,
      presenceKey: PRESENCE_KEYS.block,
      localKey: () => this.#selectedUuid,
      readKey: readGroupUuid,
      publish: (marks) => {
        this.#presence.blockSelections = marks;
      }
    });
    editorState.modelEvents.on("groupSelected", this.#onGroupSelected);
  }

  dispose(): void {
    editorState.modelEvents.off("groupSelected", this.#onGroupSelected);
    this.#tracker.dispose();
  }
}

function readGroupUuid(
  value: unknown
): string | null {
  return typeof value === "string" ? value : null;
}
