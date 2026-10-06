// Import Third-party Dependencies
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import {
  PresenceChannel,
  type PresenceChange
} from "@jolly-pixel/network/client";
import type { VoxelMapRoom } from "@jolly-pixel/asset.voxel-map/client";
import type {
  BlockRegistry,
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";
import { peerProfileColor } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type { MapDocumentSignals } from "../../../document/MapDocument.ts";
import type { BlockRenderSources } from "../../blocks/rendering/BlockRenderSources.ts";
import { Placement } from "../Placement.ts";
import { PlacementPresence } from "./PlacementPresence.ts";
import { PlacementPreview } from "../PlacementPreview.ts";
import {
  LayerSource,
  TemplateSource,
  type PlacementSource,
  type PlacementSourceRef
} from "../PlacementSource.ts";

// CONSTANTS
const kPresencePlacementKey = "placement";
const kPeerGhostOpacity = 0.3;

export interface PeerPlacementsOptions {
  room: VoxelMapRoom;
  world: VoxelWorld;
  blockRegistry: BlockRegistry;
  sources: BlockRenderSources;
  mapDocument: MapDocumentSignals;
}

export class PeerPlacements extends ActorComponent {
  #room: VoxelMapRoom;
  #world: VoxelWorld;
  #blockRegistry: BlockRegistry;
  #sources: BlockRenderSources;
  #channel: PresenceChannel<PlacementPresence | null>;
  #previews = new Map<string, PlacementPreview>();
  #layerSources = new Map<string, LayerSource | null>();
  #subscriptions: Array<() => void>;

  #onPeerChange = (
    change: PresenceChange<PlacementPresence | null>
  ): void => {
    if (change.value === undefined) {
      this.#removePreview(change.clientId);
    }
    else {
      this.#render(change.clientId);
    }
    this.actor.world.invalidate();
  };

  constructor(
    actor: Actor,
    options: PeerPlacementsOptions
  ) {
    super({
      actor,
      typeName: "PeerPlacements"
    });

    this.#room = options.room;
    this.#world = options.world;
    this.#blockRegistry = options.blockRegistry;
    this.#sources = options.sources;
    this.#channel = new PresenceChannel(options.room, {
      key: kPresencePlacementKey,
      decode: PlacementPresence.parse,
      equals: (left, right) => left === right || left?.equals(right) === true
    });
    this.#subscriptions = [
      options.mapDocument.subscribe("templatesChanged", this.#renderAll),
      options.mapDocument.subscribe("layerUpdated", this.#recapture),
      options.mapDocument.subscribe("reset", this.#recapture),
      options.mapDocument.subscribe("blockRegistryChanged", this.#rebuild),
      options.mapDocument.subscribe("blocksetsChanged", this.#rebuild)
    ];

    this.#renderAll();
    this.#channel.on("change", this.#onPeerChange);
  }

  publishLocal(
    placement: Placement | null
  ): void {
    this.#channel.publish(
      placement === null ? null : PlacementPresence.of(placement)
    );
  }

  override destroy(): void {
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
    this.#channel.off("change", this.#onPeerChange);
    this.#channel.destroy();

    for (const clientId of [...this.#previews.keys()]) {
      this.#removePreview(clientId);
    }

    super.destroy();
  }

  readonly #renderAll = (): void => {
    for (const clientId of this.#channel.values.keys()) {
      this.#render(clientId);
    }
    this.actor.world.invalidate();
  };

  readonly #recapture = (): void => {
    if (this.#layerSources.size === 0) {
      return;
    }

    this.#layerSources.clear();
    this.#renderAll();
  };

  readonly #rebuild = (): void => {
    for (const preview of this.#previews.values()) {
      preview.invalidate();
    }
    this.#renderAll();
  };

  #render(
    clientId: string
  ): void {
    const peer = this.#room.peers.get(clientId);
    if (!peer) {
      return;
    }

    const presence = this.#channel.values.get(clientId) ?? null;
    const placement = presence === null ? null : this.#placementOf(presence);
    const template = placement?.source.resolve(this.#world);
    if (placement === null || template === undefined) {
      this.#previews.get(clientId)?.hide();

      return;
    }

    this.#previewFor(clientId, peerProfileColor(clientId, peer.profile))
      .draw(placement, template);
  }

  #placementOf(
    presence: PlacementPresence
  ): Placement | null {
    const source = this.#sourceOf(presence.source);

    return source === null ?
      null :
      new Placement(source, presence.position, presence.transform);
  }

  #sourceOf(
    ref: PlacementSourceRef
  ): PlacementSource | null {
    if (ref.kind === "template") {
      return new TemplateSource(ref.templateId);
    }

    let source = this.#layerSources.get(ref.layerName);
    if (source === undefined) {
      source = LayerSource.capture(this.#world, ref.layerName);
      this.#layerSources.set(ref.layerName, source);
    }

    return source;
  }

  #previewFor(
    clientId: string,
    color: string
  ): PlacementPreview {
    const existing = this.#previews.get(clientId);
    if (existing) {
      return existing;
    }

    const preview = new PlacementPreview({
      blockRegistry: this.#blockRegistry,
      sources: this.#sources,
      color,
      opacity: kPeerGhostOpacity
    });
    preview.name = `peer-placement:${clientId}`;
    this.#previews.set(clientId, preview);
    this.actor.addChildren(preview);

    return preview;
  }

  #removePreview(
    clientId: string
  ): void {
    const preview = this.#previews.get(clientId);
    if (!preview) {
      return;
    }

    preview.removeFromParent();
    preview.dispose();
    this.#previews.delete(clientId);
  }
}
