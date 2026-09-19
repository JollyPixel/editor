// Import Third-party Dependencies
import type { PeerMarkMap } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type { ModelBlocks } from "../model/index.ts";
import type { PresenceStore } from "../state/index.ts";

// CONSTANTS
const kEmphasisOwnerPrefix = "selection:";

export interface PeerSelectionHighlightOptions {
  blocks: ModelBlocks;
  presence: PresenceStore;
}

export class PeerSelectionHighlight {
  #blocks: ModelBlocks;
  #presence: PresenceStore;
  #highlightedUuidByClient = new Map<string, string>();

  #onSelectionsChange = (
    selections: PeerMarkMap<string>
  ): void => {
    this.#apply(selections);
  };

  constructor(
    options: PeerSelectionHighlightOptions
  ) {
    this.#blocks = options.blocks;
    this.#presence = options.presence;

    this.#presence.on("blockSelectionsChange", this.#onSelectionsChange);
    this.#apply(this.#presence.blockSelections);
  }

  dispose(): void {
    this.#presence.off("blockSelectionsChange", this.#onSelectionsChange);
    this.#apply(new Map());
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
      if (nextUuidByClient.get(clientId) !== uuid) {
        this.#blocks.get(uuid)?.clearEmphasis(`${kEmphasisOwnerPrefix}${clientId}`);
      }
    }

    for (const [uuid, marks] of selections) {
      for (const mark of marks) {
        if (this.#highlightedUuidByClient.get(mark.clientId) !== uuid) {
          this.#blocks.get(uuid)?.emphasize(
            mark.color,
            `${kEmphasisOwnerPrefix}${mark.clientId}`
          );
        }
      }
    }

    this.#highlightedUuidByClient = nextUuidByClient;
  }
}
