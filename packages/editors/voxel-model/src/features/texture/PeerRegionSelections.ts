// Import Third-party Dependencies
import type { PeerPresence } from "@jolly-pixel/pixel-draw.renderer";
import type { PeerMarkMap } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type { PresenceStore } from "../../state/index.ts";
import { reconcilePeerMarks } from "../../shared/reconcilePeerMarks.ts";
import { blockRegionId } from "./blockRegionId.ts";

export type PeerRegionSelectionTarget = Pick<
  PeerPresence["uvSelections"],
  "set" | "remove" | "clearAll"
>;

export interface PeerRegionSelectionsOptions {
  presence: PresenceStore;
  target: PeerRegionSelectionTarget;
}

export class PeerRegionSelections {
  #target: PeerRegionSelectionTarget;
  #uuidByClient = new Map<string, string>();
  #unsubscribe: () => void;

  #onSelectionsChange = (
    selections: PeerMarkMap<string>
  ): void => {
    this.#uuidByClient = reconcilePeerMarks(
      selections,
      this.#uuidByClient,
      {
        hold: (peer, uuid) => this.#target.set(peer.clientId, {
          regionId: blockRegionId(uuid),
          color: peer.color
        }),
        release: (clientId) => this.#target.remove(clientId)
      }
    );
  };

  constructor(
    options: PeerRegionSelectionsOptions
  ) {
    const { presence, target } = options;
    this.#target = target;

    this.#onSelectionsChange(presence.blockSelections);
    this.#unsubscribe = presence.subscribe(
      "blockSelectionsChange",
      this.#onSelectionsChange
    );
  }

  dispose(): void {
    this.#unsubscribe();
    this.#target.clearAll();
    this.#uuidByClient.clear();
  }
}
