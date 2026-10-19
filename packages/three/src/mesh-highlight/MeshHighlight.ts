// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  MeshHighlightState,
  changedIds,
  type HighlightTechnique,
  type MeshHighlightChangeEventDetail,
  type MeshHighlightMode,
  type SelectableObject
} from "./MeshHighlightState.ts";
import {
  MeshHighlightAppearance,
  type MeshHighlightAppearanceOptions
} from "./MeshHighlightAppearance.ts";
import { HighlightResolver } from "./HighlightResolver.ts";
import type { HighlightOverlayRegistry } from "./overlays/HighlightOverlayRegistry.ts";
import { createDefaultHighlightOverlayRegistry } from "./overlays/builtinHighlightOverlayFactories.ts";
import { HighlightPass } from "./postprocess/HighlightPass.ts";
import { HighlightPassJfa } from "./postprocess/HighlightPassJfa.ts";
import {
  PeerHighlights,
  type PeerHighlightChangeEventDetail
} from "./peer/PeerHighlights.ts";
import {
  PeerVisibility,
  type PeerVisibilityOptions
} from "./peer/PeerVisibility.ts";
import { PeerSelectionChips } from "./peer/PeerSelectionChips.ts";
import type { MeshHighlightRenderer } from "./renderers/MeshHighlightRenderer.ts";
import { ObjectOverlayRenderer } from "./renderers/ObjectOverlayRenderer.ts";
import { HighlightPassRenderer } from "./renderers/HighlightPassRenderer.ts";

export interface MeshHighlightRendererContext {
  mode: MeshHighlightMode;
  renderer: THREE.WebGPURenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  appearance: MeshHighlightAppearance;
  overlayRegistry: HighlightOverlayRegistry;
}

export type MeshHighlightRendererFactory = (
  context: MeshHighlightRendererContext
) => MeshHighlightRenderer;

export interface MeshHighlightEventMap {
  selectionChange: Event;
  hoverChange: Event;
  emphasisChange: CustomEvent<MeshHighlightChangeEventDetail>;
  targetsChange: CustomEvent<MeshHighlightChangeEventDetail>;
  appearanceChange: CustomEvent<MeshHighlightChangeEventDetail>;
  techniqueChange: CustomEvent<MeshHighlightChangeEventDetail>;
  peersChange: CustomEvent<MeshHighlightChangeEventDetail>;
  visibilityChange: CustomEvent<MeshHighlightChangeEventDetail>;
  change: CustomEvent<MeshHighlightChangeEventDetail>;
  dispose: Event;
}

export interface MeshHighlight {
  addEventListener<TKey extends keyof MeshHighlightEventMap>(
    type: TKey,
    listener: (event: MeshHighlightEventMap[TKey]) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
  removeEventListener<TKey extends keyof MeshHighlightEventMap>(
    type: TKey,
    listener: (event: MeshHighlightEventMap[TKey]) => void,
    options?: boolean | EventListenerOptions
  ): void;
}

export interface MeshHighlightOptions {
  renderer: THREE.WebGPURenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  mode?: MeshHighlightMode;
  appearance?: MeshHighlightAppearance | MeshHighlightAppearanceOptions;
  overlayRegistry?: HighlightOverlayRegistry;
  /**
   * Replaces the built-in object-overlay and postprocess renderer factory.
   */
  rendererFactory?: MeshHighlightRendererFactory;
  peers?: PeerHighlights;
  /**
   * Pass `false` to disable peer frustum and distance culling.
   */
  visibility?: false | Pick<PeerVisibilityOptions, "maxDistance">;
  /**
   * @default false
   */
  chips?: boolean;
}

export class MeshHighlight extends EventTarget {
  readonly peers: PeerHighlights;
  readonly visibility: PeerVisibility | null;
  readonly chips: PeerSelectionChips;

  #state: MeshHighlightState;
  #renderer: THREE.WebGPURenderer;
  #scene: THREE.Scene;
  #camera: THREE.Camera;
  #resolver: HighlightResolver;
  #overlayRegistry: HighlightOverlayRegistry;
  #rendererFactory: MeshHighlightRendererFactory | null;
  #presentation: MeshHighlightRenderer;
  #disposed = false;

  #onPeerChange = (
    event: CustomEvent<PeerHighlightChangeEventDetail>
  ): void => {
    const { objectId, previousObjectId } = event.detail;
    this.#commit([{
      kind: "peers",
      objectIds: changedIds(previousObjectId, objectId)
    }]);
  };
  #onVisibilityChange = (): void => {
    this.#commit([{ kind: "visibility", objectIds: [] }]);
  };

  constructor(
    options: MeshHighlightOptions
  ) {
    super();
    this.#renderer = options.renderer;
    this.#scene = options.scene;
    this.#camera = options.camera;
    this.#overlayRegistry = options.overlayRegistry ??
      createDefaultHighlightOverlayRegistry();
    this.#rendererFactory = options.rendererFactory ?? null;

    this.#state = new MeshHighlightState({
      appearance: options.appearance,
      technique: options.mode
    });
    this.peers = options.peers ?? new PeerHighlights();
    this.visibility = options.visibility === false ? null :
      new PeerVisibility({
        peers: this.peers,
        state: this.#state,
        camera: this.#camera,
        maxDistance: options.visibility?.maxDistance
      });
    this.chips = new PeerSelectionChips({
      peers: this.peers,
      state: this.#state,
      visibility: this.visibility ?? undefined,
      enabled: options.chips ?? false
    });
    this.#resolver = new HighlightResolver({
      state: this.#state,
      peers: this.peers,
      visibility: this.visibility ?? undefined
    });
    this.#presentation = this.#createRenderer(this.#state.technique);

    this.peers.addEventListener("change", this.#onPeerChange);
    this.visibility?.addEventListener(
      "visibilityChange",
      this.#onVisibilityChange
    );
    this.#sync();
  }

  get overlayRegistry(): HighlightOverlayRegistry {
    return this.#overlayRegistry;
  }

  get mode(): MeshHighlightMode {
    return this.#state.technique;
  }

  set mode(
    mode: MeshHighlightMode
  ) {
    this.#assertActive();
    const previousMode = this.#state.technique;
    if (mode === previousMode) {
      return;
    }

    const next = this.#createRenderer(mode);
    this.#state.technique = mode;
    try {
      next.sync(this.#resolver.resolve(), this.#state.appearance);
    }
    catch (error) {
      next.dispose();
      this.#state.technique = previousMode;
      throw error;
    }

    this.#presentation.dispose();
    this.#presentation = next;
    this.#dispatchChange({ kind: "technique", objectIds: [] });
  }

  get appearance(): MeshHighlightAppearance {
    return this.#state.appearance;
  }

  set appearance(
    appearance: MeshHighlightAppearance
  ) {
    this.#assertActive();
    const previousAppearance = this.#state.appearance;
    if (appearance === previousAppearance) {
      return;
    }

    this.#state.appearance = appearance;
    try {
      this.#sync();
    }
    catch (error) {
      this.#state.appearance = previousAppearance;
      throw error;
    }
    this.#dispatchChange({ kind: "appearance", objectIds: [] });
  }

  get selected(): string | null {
    return this.#state.selected;
  }

  get hovered(): string | null {
    return this.#state.hovered;
  }

  get emphasized(): ReadonlySet<string> {
    return this.#state.emphasized;
  }

  register(
    id: string,
    target: SelectableObject,
    options: { technique?: HighlightTechnique; } = {}
  ): void {
    this.#assertActive();
    this.#commit(this.#state.register(id, target, options));
  }

  unregister(
    id: string
  ): void {
    this.#assertActive();
    this.#commit(this.#state.unregister(id));
  }

  select(
    id: string | null
  ): void {
    this.#assertActive();
    this.#commit(this.#state.select(id));
  }

  hover(
    id: string | null
  ): void {
    this.#assertActive();
    this.#commit(this.#state.hover(id));
  }

  emphasize(
    ids: Iterable<string>
  ): void {
    this.#assertActive();
    this.#commit(this.#state.emphasize(ids));
  }

  configure(
    appearance: MeshHighlightAppearanceOptions
  ): void {
    this.#assertActive();
    this.appearance = this.#state.appearance.with(appearance);
  }

  update(): void {
    this.#assertActive();
    this.visibility?.update();
  }

  render(): void {
    this.#assertActive();
    this.#presentation.render();
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;

    this.peers.removeEventListener("change", this.#onPeerChange);
    this.visibility?.removeEventListener(
      "visibilityChange",
      this.#onVisibilityChange
    );

    this.#presentation.dispose();
    this.chips.dispose();
    this.visibility?.dispose();
    this.#state.dispose();
    this.peers.dispose();
    this.dispatchEvent(new Event("dispose"));
  }

  #assertActive(): void {
    if (this.#disposed) {
      throw new Error("MeshHighlight has been disposed");
    }
  }

  #commit(
    changes: readonly MeshHighlightChangeEventDetail[]
  ): void {
    if (changes.length === 0 || this.#disposed) {
      return;
    }

    this.#sync();
    for (const change of changes) {
      this.#dispatchChange(change);
    }
  }

  #sync(): void {
    this.#presentation.sync(
      this.#resolver.resolve(),
      this.#state.appearance
    );
    this.chips.sync();
  }

  #dispatchChange(
    detail: MeshHighlightChangeEventDetail
  ): void {
    if (detail.kind === "selection" || detail.kind === "hover") {
      this.dispatchEvent(new Event(`${detail.kind}Change`));
    }
    else {
      this.dispatchEvent(
        new CustomEvent(`${detail.kind}Change`, { detail })
      );
    }
    this.dispatchEvent(new CustomEvent("change", { detail }));
  }

  #createRenderer(
    mode: MeshHighlightMode
  ): MeshHighlightRenderer {
    const appearance = this.#state.appearance;
    if (this.#rendererFactory) {
      return this.#rendererFactory({
        mode,
        renderer: this.#renderer,
        scene: this.#scene,
        camera: this.#camera,
        appearance,
        overlayRegistry: this.#overlayRegistry
      });
    }

    if (mode === "outline") {
      return new ObjectOverlayRenderer({
        registry: this.#overlayRegistry,
        renderScene: () => this.#renderer.render(this.#scene, this.#camera),
        camera: this.#camera
      });
    }

    const overlays = {
      overlayRegistry: this.#overlayRegistry,
      camera: this.#camera
    };
    if (mode === "highlight") {
      const highlight = new HighlightPass(
        this.#renderer,
        this.#scene,
        this.#camera,
        appearance.highlight
      );

      return new HighlightPassRenderer({
        ...overlays,
        highlight,
        configure: (next) => highlight.configure(next.highlight)
      });
    }

    const highlight = new HighlightPassJfa(
      this.#renderer,
      this.#scene,
      this.#camera,
      appearance.highlightJfa
    );

    return new HighlightPassRenderer({
      ...overlays,
      highlight,
      configure: (next) => highlight.configure(next.highlightJfa)
    });
  }
}
