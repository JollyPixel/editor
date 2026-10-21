// Import Third-party Dependencies
import type { VoxelWorld } from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { TemplateDraftId } from "../../../map/TemplateDraftId.ts";
import {
  parseLayerRef,
  type EditContext,
  type PresenceStore
} from "../../../state/index.ts";

export type PeerEditContextEvents = {
  change: () => void;
};

export interface PeerEditContextOptions {
  world: Pick<VoxelWorld, "getLayer">;
  context: Pick<EditContext, "draft" | "subscribe">;
  presence: Pick<PresenceStore, "layerSelections" | "subscribe">;
}

export class PeerEditContext extends Emitter<PeerEditContextEvents> {
  readonly #world: Pick<VoxelWorld, "getLayer">;
  readonly #context: Pick<EditContext, "draft">;
  readonly #presence: Pick<PresenceStore, "layerSelections">;
  readonly #subscriptions: Array<() => void>;

  constructor(
    options: PeerEditContextOptions
  ) {
    super();
    this.#world = options.world;
    this.#context = options.context;
    this.#presence = options.presence;

    const announce = (): void => {
      this.emit("change");
    };
    this.#subscriptions = [
      options.context.subscribe("change", announce),
      options.presence.subscribe("layerSelectionsChange", announce)
    ];
  }

  shares(
    clientId: string
  ): boolean {
    return this.#draftLayerId(clientId) ===
      (this.#context.draft?.layerId ?? null);
  }

  dispose(): void {
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
  }

  #draftLayerId(
    clientId: string
  ): string | null {
    for (const [key, peers] of this.#presence.layerSelections) {
      if (!peers.some((peer) => peer.clientId === clientId)) {
        continue;
      }

      const ref = parseLayerRef(key);
      const layer = ref.kind === "voxel-layer" ?
        this.#world.getLayer(ref.name) :
        undefined;

      return layer !== undefined && TemplateDraftId.isDraft(layer) ?
        layer.id :
        null;
    }

    return null;
  }
}
