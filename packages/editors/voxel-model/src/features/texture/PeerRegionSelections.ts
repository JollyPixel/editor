// Import Third-party Dependencies
import type { PeerPresence } from "@jolly-pixel/pixel-draw.renderer";
import { PeerMarkSync } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { PresenceStore } from "../../state/index.ts";
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
  #unsubscribe: () => void;

  constructor(
    options: PeerRegionSelectionsOptions
  ) {
    const { presence, target } = options;
    this.#target = target;

    const regions = new PeerMarkSync<string>({
      hold: (peer, uuid) => target.set(peer.clientId, {
        regionId: blockRegionId(uuid),
        color: peer.color
      }),
      release: (clientId) => target.remove(clientId)
    });
    regions.apply(presence.blockSelections);
    this.#unsubscribe = presence.subscribe(
      "blockSelectionsChange",
      (selections) => regions.apply(selections)
    );
  }

  dispose(): void {
    this.#unsubscribe();
    this.#target.clearAll();
  }
}
