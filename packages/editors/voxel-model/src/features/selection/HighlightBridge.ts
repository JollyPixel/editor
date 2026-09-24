// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import type { OrbitFlyCamera, Systems } from "@jolly-pixel/engine";
import {
  MeshHighlight,
  PeerHoverRegistry,
  PeerSelectionRegistry,
  type PeerColorAllocator
} from "@jolly-pixel/three";
import type { PeerMarkMap } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type { ModelBlock, ModelBlocks } from "../../scene/blocks/index.ts";
import { SELECTION_HIGHLIGHT_COLOR } from "../../scene/blocks/ModelBlock.ts";
import { RenderOrder } from "../../scene/renderOrder.ts";
import type {
  BlockSelectionStore,
  PresenceStore
} from "../../state/index.ts";

// CONSTANTS
const kBoxSilhouetteTechnique = "boxSilhouette";
const kOutlineThickness = 0.05;
const kSelectionOpacity = 0.5;
const kHoverOpacity = 0.3;
const kOccludedOpacityScale = 0.25;

export interface HighlightBridgeOptions {
  renderer: THREE.WebGPURenderer;
  scene: THREE.Scene;
  camera: OrbitFlyCamera;
  blocks: ModelBlocks;
  selection: BlockSelectionStore;
  presence: PresenceStore;
}

export class HighlightBridge implements Systems.RenderComponent {
  readonly threeCamera: THREE.Camera;
  readonly viewport = null;
  readonly depth: number;

  #meshHighlight: MeshHighlight;
  #blocks: ModelBlocks;
  #selection: BlockSelectionStore;
  #presence: PresenceStore;
  #selectedBlock: ModelBlock | null = null;
  #highlightedUuidByClient = new Map<string, string>();
  #hoveredUuidByClient = new Map<string, string>();

  #onBlockAdded = (
    block: ModelBlock
  ): void => {
    this.#meshHighlight.register(block.uuid, block.mesh, { technique: kBoxSilhouetteTechnique });
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
    this.threeCamera = options.camera.threeCamera;
    this.depth = options.camera.depth;
    this.#blocks = options.blocks;
    this.#selection = options.selection;
    this.#presence = options.presence;

    const peerColorAllocator: PeerColorAllocator = {
      colorOf: (peerId) => this.#presence.peers.find((peer) => peer.clientId === peerId)?.color ?? "#ffffff",
      release: () => void 0
    };

    this.#meshHighlight = new MeshHighlight({
      renderer: options.renderer,
      scene: options.scene,
      camera: options.camera.threeCamera,
      mode: "outline",
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
      peerSelections: new PeerSelectionRegistry({ colorAllocator: peerColorAllocator }),
      peerHovers: new PeerHoverRegistry({ colorAllocator: peerColorAllocator })
    });

    for (const block of this.#blocks.values()) {
      this.#onBlockAdded(block);
    }
    this.#onSelect(this.#selection.selected);
    this.#onHover(this.#selection.hovered);
    this.#applyPresence(this.#presence.blockSelections);
    this.#applyHoverPresence(this.#presence.blockHovers);

    this.#blocks.on("blockAdded", this.#onBlockAdded);
    this.#blocks.on("blockRemoved", this.#onBlockRemoved);
    this.#selection.on("select", this.#onSelect);
    this.#selection.on("hover", this.#onHover);
    this.#presence.on("blockSelectionsChange", this.#onPresenceChange);
    this.#presence.on("blockHoversChange", this.#onHoverPresenceChange);
  }

  prepareRender(): void {
    this.#meshHighlight.update();
    this.#meshHighlight.render();
  }

  dispose(): void {
    this.#blocks.off("blockAdded", this.#onBlockAdded);
    this.#blocks.off("blockRemoved", this.#onBlockRemoved);
    this.#selection.off("select", this.#onSelect);
    this.#selection.off("hover", this.#onHover);
    this.#presence.off("blockSelectionsChange", this.#onPresenceChange);
    this.#presence.off("blockHoversChange", this.#onHoverPresenceChange);
    this.#meshHighlight.dispose();
  }

  #applyPresence(
    selections: PeerMarkMap<string>
  ): void {
    this.#highlightedUuidByClient = reconcilePeerMarks(
      selections,
      this.#highlightedUuidByClient,
      (clientId, uuid) => this.#meshHighlight.peerSelections.select(clientId, uuid)
    );
  }

  #applyHoverPresence(
    hovers: PeerMarkMap<string>
  ): void {
    this.#hoveredUuidByClient = reconcilePeerMarks(
      hovers,
      this.#hoveredUuidByClient,
      (clientId, uuid) => this.#meshHighlight.peerHovers.hover(clientId, uuid)
    );
  }
}

/**
 * Diffs a peer mark map against who held which uuid last time, calling
 * `apply` once per client whose uuid changed (null when they let go).
 */
function reconcilePeerMarks(
  marks: PeerMarkMap<string>,
  previous: ReadonlyMap<string, string>,
  apply: (
    clientId: string,
    uuid: string | null
  ) => void
): Map<string, string> {
  const next = new Map<string, string>();
  for (const [uuid, entries] of marks) {
    for (const mark of entries) {
      next.set(mark.clientId, uuid);
    }
  }

  for (const [clientId, uuid] of previous) {
    if (next.get(clientId) !== uuid) {
      apply(clientId, null);
    }
  }
  for (const [clientId, uuid] of next) {
    if (previous.get(clientId) !== uuid) {
      apply(clientId, uuid);
    }
  }

  return next;
}
