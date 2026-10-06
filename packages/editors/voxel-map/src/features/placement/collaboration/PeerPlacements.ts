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
import { MarqueePresence } from "./MarqueePresence.ts";
import { PlacementPresence } from "./PlacementPresence.ts";
import { CopyPresence } from "./CopyPresence.ts";
import { RegionPresence } from "./RegionPresence.ts";
import { PlacementPreview } from "../PlacementPreview.ts";
import {
  LayerSource,
  TemplateSource,
  type PlacementSource,
  type PlacementSourceRef
} from "../PlacementSource.ts";
import type { CopySourceRef } from "../CopySource.ts";
import type { RegionSourceRef } from "../RegionSource.ts";

// CONSTANTS
const kPresencePlacementKey = "placement";
const kPresenceFloatingKey = "floating";
const kPeerGhostOpacity = 0.3;

export type PeerPlacementPresence = PlacementPresence | MarqueePresence;
type FloatingPresence = RegionPresence | CopyPresence;
type FloatingSource = FloatingPresence["source"];

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
  #channel: PresenceChannel<PeerPlacementPresence | null>;
  #floating: PresenceChannel<FloatingPresence | null>;
  #previews = new Map<string, PlacementPreview>();
  #layerSources = new Map<string, LayerSource | null>();
  #localFloating: FloatingSource | null = null;
  #subscriptions: Array<() => void>;

  #onPeerChange = (
    change: PresenceChange<PeerPlacementPresence | null>
  ): void => {
    if (change.value === undefined) {
      this.#removePreview(change.clientId);
    }
    else {
      this.#render(change.clientId);
    }
    this.actor.world.invalidate();
  };

  #onPeerFloatingChange = (
    change: PresenceChange<FloatingPresence | null>
  ): void => {
    this.#render(change.clientId);
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
      decode: (value) => PlacementPresence.parse(value) ??
        MarqueePresence.parse(value),
      equals: samePresence
    });
    this.#floating = new PresenceChannel(options.room, {
      key: kPresenceFloatingKey,
      decode: (value) => RegionPresence.parse(value) ??
        CopyPresence.parse(value),
      equals: sameFloating
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
    this.#floating.on("change", this.#onPeerFloatingChange);
  }

  publishLocal(
    value: Placement | MarqueePresence | null
  ): void {
    const floating = value instanceof Placement ?
      floatingSourceOf(value.source) :
      null;
    if (floating !== this.#localFloating) {
      this.#localFloating = floating;
      this.#floating.publish(floatingPresenceOf(floating));
    }
    this.#channel.publish(
      value instanceof Placement ? PlacementPresence.of(value) : value
    );
  }

  override destroy(): void {
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
    this.#channel.off("change", this.#onPeerChange);
    this.#channel.destroy();
    this.#floating.off("change", this.#onPeerFloatingChange);
    this.#floating.destroy();

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
    const color = peerProfileColor(clientId, peer.profile);
    if (presence instanceof MarqueePresence) {
      this.#previewFor(clientId, color).outline(presence.region);

      return;
    }

    const placement = presence === null ?
      null :
      this.#placementOf(clientId, presence);
    const template = placement?.source.resolve(this.#world);
    if (placement === null || template === undefined) {
      this.#previews.get(clientId)?.hide();

      return;
    }

    this.#previewFor(clientId, color).draw(placement, template);
  }

  #placementOf(
    clientId: string,
    presence: PlacementPresence
  ): Placement | null {
    const source = this.#sourceOf(clientId, presence.source);

    return source === null ?
      null :
      new Placement(source, presence.position, presence.transform);
  }

  #sourceOf(
    clientId: string,
    ref: PlacementSourceRef
  ): PlacementSource | null {
    switch (ref.kind) {
      case "template":
        return new TemplateSource(ref.templateId);
      case "layer":
        return this.#layerSourceOf(ref.layerName);
      case "region":
      case "copy":
        return this.#floatingSourceOf(clientId, ref);
    }
  }

  #layerSourceOf(
    layerName: string
  ): LayerSource | null {
    let source = this.#layerSources.get(layerName);
    if (source === undefined) {
      source = LayerSource.capture(this.#world, layerName);
      this.#layerSources.set(layerName, source);
    }

    return source;
  }

  #floatingSourceOf(
    clientId: string,
    ref: RegionSourceRef | CopySourceRef
  ): FloatingSource | null {
    const presence = this.#floating.values.get(clientId) ?? null;
    if (ref.kind === "region") {
      return presence instanceof RegionPresence && presence.describes(ref) ?
        presence.source :
        null;
    }

    return presence instanceof CopyPresence && presence.describes(ref) ?
      presence.source :
      null;
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

function samePresence(
  left: PeerPlacementPresence | null,
  right: PeerPlacementPresence | null
): boolean {
  if (left === right) {
    return true;
  }
  if (left instanceof PlacementPresence) {
    return right instanceof PlacementPresence && left.equals(right);
  }
  if (left instanceof MarqueePresence) {
    return right instanceof MarqueePresence && left.equals(right);
  }

  return false;
}

function sameFloating(
  left: FloatingPresence | null,
  right: FloatingPresence | null
): boolean {
  if (left === right) {
    return true;
  }
  if (left instanceof RegionPresence) {
    return right instanceof RegionPresence && left.equals(right);
  }
  if (left instanceof CopyPresence) {
    return right instanceof CopyPresence && left.equals(right);
  }

  return false;
}

function floatingSourceOf(
  source: PlacementSource
): FloatingSource | null {
  return source.kind === "region" || source.kind === "copy" ?
    source :
    null;
}

function floatingPresenceOf(
  source: FloatingSource | null
): FloatingPresence | null {
  if (source === null) {
    return null;
  }

  return source.kind === "region" ?
    new RegionPresence(source) :
    new CopyPresence(source);
}
