// Import Third-party Dependencies
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import type ModelManager from "../features/groups/ModelManager.ts";
import {
  editorState,
  type PresenceStore
} from "../app/state/index.ts";
import type { PeerMarkMap } from "./peerMarks.ts";

// CONSTANTS
const kEmphasisOwnerPrefix = "selection:";

export interface PeerSelectionHighlightOptions {
  modelManager: ModelManager;
  presence?: PresenceStore;
}

export class PeerSelectionHighlight extends ActorComponent {
  #modelManager: ModelManager;
  #presence: PresenceStore;
  #highlightedUuidByClient = new Map<string, string>();

  #onSelectionsChange = (
    selections: PeerMarkMap<string>
  ): void => {
    this.#apply(selections);
  };

  constructor(
    actor: Actor,
    options: PeerSelectionHighlightOptions
  ) {
    super({
      actor,
      typeName: "PeerSelectionHighlight"
    });

    this.#modelManager = options.modelManager;
    this.#presence = options.presence ?? editorState.presence;

    this.#presence.on("blockSelectionsChange", this.#onSelectionsChange);
    this.#apply(this.#presence.blockSelections);
  }

  override destroy(): void {
    this.#presence.off("blockSelectionsChange", this.#onSelectionsChange);
    this.#apply(new Map());

    super.destroy();
  }

  #apply(
    selections: PeerMarkMap<string>
  ): void {
    const nextUuidByClient = new Map<string, string>();
    for (const [uuid, marks] of selections) {
      for (const mark of marks) {
        nextUuidByClient.set(mark.clientId, uuid);
      }
    }

    for (const [clientId, uuid] of this.#highlightedUuidByClient) {
      if (nextUuidByClient.get(clientId) === uuid) {
        continue;
      }
      this.#modelManager.getGroupByUUID(uuid)?.clearEmphasis(`${kEmphasisOwnerPrefix}${clientId}`);
    }

    for (const [uuid, marks] of selections) {
      for (const mark of marks) {
        if (this.#highlightedUuidByClient.get(mark.clientId) === uuid) {
          continue;
        }
        this.#modelManager.getGroupByUUID(uuid)?.emphasize(
          mark.color,
          `${kEmphasisOwnerPrefix}${mark.clientId}`
        );
      }
    }

    this.#highlightedUuidByClient = nextUuidByClient;
  }
}
