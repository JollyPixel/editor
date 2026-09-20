// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  MeshHighlightState,
  type SelectableObject,
  type MeshHighlightStateChangeEventDetail,
  type MeshHighlightStateChangeKind,
  type HighlightTechnique
} from "./MeshHighlightState.ts";
import {
  MeshHighlightAppearance,
  type MeshHighlightAppearanceOptions
} from "./MeshHighlightAppearance.ts";
import { HighlightResolver } from "./HighlightResolver.ts";
import type { HighlightOverlayRegistry } from "./overlays/HighlightOverlayRegistry.ts";
import { createDefaultHighlightOverlayRegistry } from "./overlays/builtinHighlightOverlayFactories.ts";
import {
  HighlightPass,
  type HighlightPassOptions
} from "./postprocess/HighlightPass.ts";
import {
  HighlightPassJfa,
  type HighlightPassJfaOptions
} from "./postprocess/HighlightPassJfa.ts";
import { PeerSelectionRegistry } from "./peer/PeerSelectionRegistry.ts";
import { PeerHoverRegistry } from "./peer/PeerHoverRegistry.ts";
import {
  PeerSelectionVisibility,
  type PeerSelectionVisibilityOptions
} from "./peer/PeerSelectionVisibility.ts";
import { PeerSelectionChips } from "./peer/PeerSelectionChips.ts";
import type { MeshHighlightRenderer } from "./renderers/MeshHighlightRenderer.ts";
import { ObjectOverlayRenderer } from "./renderers/ObjectOverlayRenderer.ts";
import { HighlightPassRenderer } from "./renderers/HighlightPassRenderer.ts";

export type MeshHighlightMode = "outline" | "highlight" | "highlightJfa";

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

export type MeshHighlightChangeKind = MeshHighlightStateChangeKind |
  "peers" | "visibility";

export interface MeshHighlightChangeEventDetail {
  kind: MeshHighlightChangeKind;
  objectIds: readonly string[];
}

export interface MeshHighlightEventMap {
  selectionChange: Event;
  hoverChange: Event;
  targetsChange: CustomEvent<MeshHighlightChangeEventDetail>;
  appearanceChange: CustomEvent<MeshHighlightChangeEventDetail>;
  techniqueChange: CustomEvent<MeshHighlightChangeEventDetail>;
  peerChange: CustomEvent<MeshHighlightChangeEventDetail>;
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
  peerSelections?: PeerSelectionRegistry;
  peerHovers?: PeerHoverRegistry;
  /**
   * Pass `false` to disable peer frustum and distance culling.
   */
  visibility?: false | Pick<PeerSelectionVisibilityOptions, "maxDistance">;
  /**
   * @default false
   */
  chips?: boolean;
}

/**
 * Owns selection state, peer state, visibility and the active renderer.
 */
export class MeshHighlight extends EventTarget {
  readonly state: MeshHighlightState;
  readonly peerSelections: PeerSelectionRegistry;
  readonly peerHovers: PeerHoverRegistry;
  readonly visibility: PeerSelectionVisibility | null;
  readonly chips: PeerSelectionChips;

  #renderer: THREE.WebGPURenderer;
  #scene: THREE.Scene;
  #camera: THREE.Camera;
  #resolver: HighlightResolver;
  #overlayRegistry: HighlightOverlayRegistry;
  #rendererFactory: MeshHighlightRendererFactory | null;
  #presentation: MeshHighlightRenderer;
  #mode: MeshHighlightMode;
  #synchronize = true;
  #disposed = false;

  #onStateChange = (
    event: CustomEvent<MeshHighlightStateChangeEventDetail>
  ): void => {
    if (!this.#synchronize || this.#disposed) {
      return;
    }
    this.#sync();
    this.#dispatchChange(event.detail);
  };
  #onPeerChange = (): void => {
    this.#syncAndDispatch("peers");
  };
  #onVisibilityChange = (): void => {
    this.#syncAndDispatch("visibility");
  };

  constructor(
    options: MeshHighlightOptions
  ) {
    super();
    this.#renderer = options.renderer;
    this.#scene = options.scene;
    this.#camera = options.camera;
    this.#mode = options.mode ?? "outline";
    this.#overlayRegistry = options.overlayRegistry ??
      createDefaultHighlightOverlayRegistry();
    this.#rendererFactory = options.rendererFactory ?? null;

    this.state = new MeshHighlightState({
      appearance: options.appearance,
      technique: this.#mode,
      overlayRegistry: this.#overlayRegistry,
      renderOverlays: false
    });
    this.peerSelections = options.peerSelections ?? new PeerSelectionRegistry();
    this.peerHovers = options.peerHovers ?? new PeerHoverRegistry();
    this.visibility = options.visibility === false ? null :
      new PeerSelectionVisibility({
        registry: this.peerSelections,
        hoverRegistry: this.peerHovers,
        selection: this.state,
        camera: this.#camera,
        maxDistance: options.visibility?.maxDistance
      });
    this.chips = new PeerSelectionChips({
      registry: this.peerSelections,
      selection: this.state,
      visibility: this.visibility ?? undefined,
      enabled: options.chips ?? false
    });
    this.#resolver = new HighlightResolver({
      state: this.state,
      peerSelections: this.peerSelections,
      peerHovers: this.peerHovers,
      visibility: this.visibility ?? undefined
    });
    this.#presentation = this.#createRenderer(this.#mode);

    this.state.addEventListener("change", this.#onStateChange);
    this.peerSelections.addEventListener(
      "peerSelectionChange",
      this.#onPeerChange
    );
    this.peerHovers.addEventListener("peerHoverChange", this.#onPeerChange);
    this.visibility?.addEventListener(
      "visibilityChange",
      this.#onVisibilityChange
    );
    this.#sync();
  }

  get mode(): MeshHighlightMode {
    return this.#mode;
  }

  set mode(
    mode: MeshHighlightMode
  ) {
    this.#assertActive();
    if (mode === this.#mode) {
      return;
    }

    const previousTechnique = this.state.technique;
    const next = this.#createRenderer(mode);
    this.#synchronize = false;
    try {
      this.state.technique = mode;
      next.sync(this.#resolver.resolve(), this.state.appearance);
    }
    catch (error) {
      next.dispose();
      this.state.technique = previousTechnique;
      throw error;
    }
    finally {
      this.#synchronize = true;
    }

    const previous = this.#presentation;
    this.#presentation = next;
    this.#mode = mode;
    previous.dispose();
    this.#dispatchChange({
      kind: "technique",
      objectIds: []
    });
  }

  get appearance(): MeshHighlightAppearance {
    return this.state.appearance;
  }

  set appearance(
    appearance: MeshHighlightAppearance
  ) {
    this.#assertActive();
    if (appearance === this.state.appearance) {
      return;
    }
    this.#replaceAppearance(appearance);
  }

  get selected(): string | null {
    return this.state.selected;
  }

  get hovered(): string | null {
    return this.state.hovered;
  }

  register(
    id: string,
    target: SelectableObject,
    options: { technique?: HighlightTechnique; } = {}
  ): void {
    this.#assertActive();
    this.state.register(id, target, options);
  }

  unregister(
    id: string
  ): void {
    this.#assertActive();
    this.state.unregister(id);
  }

  select(
    id: string | null
  ): void {
    this.#assertActive();
    this.state.select(id);
  }

  hover(
    id: string | null
  ): void {
    this.#assertActive();
    this.state.hover(id);
  }

  configure(
    appearance: MeshHighlightAppearanceOptions
  ): void {
    this.#assertActive();
    this.appearance = this.state.appearance.with(appearance);
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

    this.state.removeEventListener("change", this.#onStateChange);
    this.peerSelections.removeEventListener(
      "peerSelectionChange",
      this.#onPeerChange
    );
    this.peerHovers.removeEventListener("peerHoverChange", this.#onPeerChange);
    this.visibility?.removeEventListener(
      "visibilityChange",
      this.#onVisibilityChange
    );

    this.#presentation.dispose();
    this.chips.dispose();
    this.visibility?.dispose();
    this.state.dispose();
    this.peerSelections.dispose();
    this.peerHovers.dispose();
    this.dispatchEvent(new Event("dispose"));
  }

  #replaceAppearance(
    nextAppearance: MeshHighlightAppearance
  ): void {
    const previousAppearance = this.state.appearance;
    const next = this.#createRenderer(this.#mode, nextAppearance);
    this.#synchronize = false;
    try {
      this.state.appearance = nextAppearance;
      next.sync(this.#resolver.resolve(), this.state.appearance);
    }
    catch (error) {
      next.dispose();
      this.state.appearance = previousAppearance;
      throw error;
    }
    finally {
      this.#synchronize = true;
    }

    const previous = this.#presentation;
    this.#presentation = next;
    previous.dispose();
    this.#dispatchChange({
      kind: "appearance",
      objectIds: []
    });
  }

  #assertActive(): void {
    if (this.#disposed) {
      throw new Error("MeshHighlight has been disposed");
    }
  }

  #sync(): void {
    if (!this.#synchronize || this.#disposed) {
      return;
    }
    this.#presentation.sync(
      this.#resolver.resolve(),
      this.state.appearance
    );
  }

  #syncAndDispatch(
    kind: "peers" | "visibility"
  ): void {
    if (!this.#synchronize || this.#disposed) {
      return;
    }
    this.#sync();
    this.#dispatchChange({
      kind,
      objectIds: []
    });
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
    mode: MeshHighlightMode,
    appearance = this.state.appearance
  ): MeshHighlightRenderer {
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
        renderScene: () => this.#renderer.render(this.#scene, this.#camera)
      });
    }

    const highlight = mode === "highlight" ?
      new HighlightPass(
        this.#renderer,
        this.#scene,
        this.#camera,
        appearance.highlight satisfies HighlightPassOptions
      ) :
      new HighlightPassJfa(
        this.#renderer,
        this.#scene,
        this.#camera,
        appearance.highlightJfa satisfies HighlightPassJfaOptions
      );

    return new HighlightPassRenderer({
      highlight,
      overlayRegistry: this.#overlayRegistry
    });
  }
}
