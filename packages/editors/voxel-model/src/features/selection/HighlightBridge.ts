// Import Third-party Dependencies
import type * as THREE from "three/webgpu";
import {
  MeshHighlight,
  ObjectOverlayRenderer,
  PeerHighlights
} from "@jolly-pixel/three";
import {
  reconcilePeerMarks,
  type PeerMarkMap
} from "@jolly-pixel/ui/network";
import { presenceColorAllocator } from "@jolly-pixel/editor.host/viewport";

// Import Internal Dependencies
import type { ModelBlock, ModelBlocks } from "../../scene/blocks/index.ts";
import { SELECTION_HIGHLIGHT_COLOR } from "../../scene/blocks/ModelBlock.ts";
import { RenderOrder } from "../../scene/renderOrder.ts";
import type {
  BlockSelectionStore,
  PresenceStore
} from "../../state/index.ts";

// CONSTANTS
const kSilhouetteTechnique = "silhouette";
const kOutlineThickness = 0.05;
const kSelectionOpacity = 0.5;
const kHoverOpacity = 0.2;
const kOccludedOpacityScale = 0.25;

export interface HighlightBridgeOptions {
  renderer: THREE.WebGPURenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  blocks: ModelBlocks;
  selection: BlockSelectionStore;
  presence: PresenceStore;
}

export class HighlightBridge {
  #meshHighlight: MeshHighlight;
  #blocks: ModelBlocks;
  #selection: BlockSelectionStore;
  #presence: PresenceStore;
  #selectedBlock: ModelBlock | null = null;
  #highlightedUuidByClient = new Map<string, string>();
  #hoveredUuidByClient = new Map<string, string>();
  #subscriptions: Array<() => void>;

  #onBlockAdded = (
    block: ModelBlock
  ): void => {
    this.#meshHighlight.register(block.uuid, block.mesh, { technique: kSilhouetteTechnique });
  };

  #onBlockRemoved = (
    uuid: string
  ): void => {
    this.#meshHighlight.unregister(uuid);
  };

  #onSelect = (
    uuid: string | null
  ): void => {
    this.#selectedBlock?.hideSelectionGhost();
    this.#selectedBlock = uuid === null ? null : this.#blocks.get(uuid) ?? null;
    this.#selectedBlock?.showSelectionGhost();
    this.#meshHighlight.select(uuid);
  };

  #onHover = (
    uuid: string | null
  ): void => {
    this.#meshHighlight.hover(uuid);
  };

  #onEmphasize = (
    uuids: readonly string[]
  ): void => {
    this.#meshHighlight.emphasize(
      uuids.filter((uuid) => this.#blocks.get(uuid) !== undefined)
    );
  };

  #onPresenceChange = (
    selections: PeerMarkMap<string>
  ): void => {
    this.#applyPresence(selections);
  };

  #onHoverPresenceChange = (
    hovers: PeerMarkMap<string>
  ): void => {
    this.#applyHoverPresence(hovers);
  };

  constructor(
    options: HighlightBridgeOptions
  ) {
    this.#blocks = options.blocks;
    this.#selection = options.selection;
    this.#presence = options.presence;

    this.#meshHighlight = new MeshHighlight({
      renderer: options.renderer,
      scene: options.scene,
      camera: options.camera,
      mode: "outline",
      rendererFactory: ({ camera, overlayRegistry }) => new ObjectOverlayRenderer({
        registry: overlayRegistry,
        camera
      }),
      chips: true,
      appearance: {
        xray: true,
        xrayDepthWrite: true,
        renderOrder: RenderOrder.outline,
        selected: { color: SELECTION_HIGHLIGHT_COLOR, opacity: kSelectionOpacity },
        hovered: { color: SELECTION_HIGHLIGHT_COLOR, opacity: kHoverOpacity },
        outline: { linewidth: kOutlineThickness },
        occludedOpacityScale: kOccludedOpacityScale
      },
      peers: new PeerHighlights({
        colorAllocator: presenceColorAllocator(() => this.#presence.peers)
      })
    });

    for (const block of this.#blocks.values()) {
      this.#onBlockAdded(block);
    }
    this.#onSelect(this.#selection.selected);
    this.#onHover(this.#selection.hovered);
    this.#onEmphasize(this.#selection.emphasized);
    this.#applyPresence(this.#presence.blockSelections);
    this.#applyHoverPresence(this.#presence.blockHovers);

    this.#subscriptions = [
      this.#blocks.subscribe("blockAdded", this.#onBlockAdded),
      this.#blocks.subscribe("blockRemoved", this.#onBlockRemoved),
      this.#selection.subscribe("select", this.#onSelect),
      this.#selection.subscribe("hover", this.#onHover),
      this.#selection.subscribe("emphasize", this.#onEmphasize),
      this.#presence.subscribe("blockSelectionsChange", this.#onPresenceChange),
      this.#presence.subscribe("blockHoversChange", this.#onHoverPresenceChange)
    ];
  }

  readonly update = (): void => {
    this.#meshHighlight.update();
    this.#meshHighlight.render();
  };

  dispose(): void {
    for (const unsubscribe of this.#subscriptions) {
      unsubscribe();
    }
    this.#meshHighlight.dispose();
  }

  #applyPresence(
    selections: PeerMarkMap<string>
  ): void {
    const { peers } = this.#meshHighlight;
    this.#highlightedUuidByClient = reconcilePeerMarks(
      selections,
      this.#highlightedUuidByClient,
      {
        hold: (peer, uuid) => peers.select(peer.clientId, uuid),
        release: (clientId) => peers.select(clientId, null)
      }
    );
  }

  #applyHoverPresence(
    hovers: PeerMarkMap<string>
  ): void {
    const { peers } = this.#meshHighlight;
    this.#hoveredUuidByClient = reconcilePeerMarks(
      hovers,
      this.#hoveredUuidByClient,
      {
        hold: (peer, uuid) => peers.hover(peer.clientId, uuid),
        release: (clientId) => peers.hover(clientId, null)
      }
    );
  }
}
