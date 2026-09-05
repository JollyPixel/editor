// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  SelectionManager,
  type SelectableObject,
  type SelectionManagerChangeEventDetail,
  type SelectionManagerChangeKind,
  type SelectionTechnique
} from "./SelectionManager.ts";
import {
  SelectionAppearance,
  type SelectionAppearanceOptions
} from "./SelectionAppearance.ts";
import { SelectionResolver } from "./SelectionResolver.ts";
import type { SelectionOverlayRegistry } from "./overlays/SelectionOverlayRegistry.ts";
import { createDefaultSelectionOverlayRegistry } from "./overlays/builtinSelectionOverlayFactories.ts";
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
import type { SelectionRenderer } from "./renderers/SelectionRenderer.ts";
import { ObjectOverlaySelectionRenderer } from "./renderers/ObjectOverlaySelectionRenderer.ts";
import { HighlightSelectionRenderer } from "./renderers/HighlightSelectionRenderer.ts";

export type SelectionRenderMode = "outline" | "highlight" | "highlightJfa";

export interface SelectionRendererContext {
  mode: SelectionRenderMode;
  renderer: THREE.WebGPURenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  appearance: SelectionAppearance;
  overlayRegistry: SelectionOverlayRegistry;
}

export type SelectionRendererFactory = (
  context: SelectionRendererContext
) => SelectionRenderer;

export type SelectionSystemChangeKind = SelectionManagerChangeKind |
  "peers" | "visibility";

export interface SelectionSystemChangeEventDetail {
  kind: SelectionSystemChangeKind;
  objectIds: readonly string[];
}

export interface SelectionSystemEventMap {
  selectionChange: Event;
  hoverChange: Event;
  targetsChange: CustomEvent<SelectionSystemChangeEventDetail>;
  appearanceChange: CustomEvent<SelectionSystemChangeEventDetail>;
  techniqueChange: CustomEvent<SelectionSystemChangeEventDetail>;
  peerChange: CustomEvent<SelectionSystemChangeEventDetail>;
  visibilityChange: CustomEvent<SelectionSystemChangeEventDetail>;
  change: CustomEvent<SelectionSystemChangeEventDetail>;
  dispose: Event;
}

export interface SelectionSystem {
  addEventListener<TKey extends keyof SelectionSystemEventMap>(
    type: TKey,
    listener: (event: SelectionSystemEventMap[TKey]) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
  removeEventListener<TKey extends keyof SelectionSystemEventMap>(
    type: TKey,
    listener: (event: SelectionSystemEventMap[TKey]) => void,
    options?: boolean | EventListenerOptions
  ): void;
}

export interface SelectionSystemOptions {
  renderer: THREE.WebGPURenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  mode?: SelectionRenderMode;
  appearance?: SelectionAppearance | SelectionAppearanceOptions;
  overlayRegistry?: SelectionOverlayRegistry;
  /**
   * Replaces the built-in object-overlay and postprocess renderer factory.
   */
  rendererFactory?: SelectionRendererFactory;
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
export class SelectionSystem extends EventTarget {
  readonly manager: SelectionManager;
  readonly peerSelections: PeerSelectionRegistry;
  readonly peerHovers: PeerHoverRegistry;
  readonly visibility: PeerSelectionVisibility | null;
  readonly chips: PeerSelectionChips;

  #renderer: THREE.WebGPURenderer;
  #scene: THREE.Scene;
  #camera: THREE.Camera;
  #resolver: SelectionResolver;
  #overlayRegistry: SelectionOverlayRegistry;
  #rendererFactory: SelectionRendererFactory | null;
  #presentation: SelectionRenderer;
  #mode: SelectionRenderMode;
  #synchronize = true;
  #disposed = false;

  #onManagerChange = (
    event: CustomEvent<SelectionManagerChangeEventDetail>
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
    options: SelectionSystemOptions
  ) {
    super();
    this.#renderer = options.renderer;
    this.#scene = options.scene;
    this.#camera = options.camera;
    this.#mode = options.mode ?? "outline";
    this.#overlayRegistry = options.overlayRegistry ??
      createDefaultSelectionOverlayRegistry();
    this.#rendererFactory = options.rendererFactory ?? null;

    this.manager = new SelectionManager({
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
        selection: this.manager,
        camera: this.#camera,
        maxDistance: options.visibility?.maxDistance
      });
    this.chips = new PeerSelectionChips({
      registry: this.peerSelections,
      selection: this.manager,
      visibility: this.visibility ?? undefined,
      enabled: options.chips ?? false
    });
    this.#resolver = new SelectionResolver({
      selection: this.manager,
      peerSelections: this.peerSelections,
      peerHovers: this.peerHovers,
      visibility: this.visibility ?? undefined
    });
    this.#presentation = this.#createRenderer(this.#mode);

    this.manager.addEventListener("change", this.#onManagerChange);
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

  get mode(): SelectionRenderMode {
    return this.#mode;
  }

  set mode(
    mode: SelectionRenderMode
  ) {
    this.#assertActive();
    if (mode === this.#mode) {
      return;
    }

    const previousTechnique = this.manager.technique;
    const next = this.#createRenderer(mode);
    this.#synchronize = false;
    try {
      this.manager.technique = mode;
      next.sync(this.#resolver.resolve(), this.manager.appearance);
    }
    catch (error) {
      next.dispose();
      this.manager.technique = previousTechnique;
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

  get appearance(): SelectionAppearance {
    return this.manager.appearance;
  }

  set appearance(
    appearance: SelectionAppearance
  ) {
    this.#assertActive();
    if (appearance === this.manager.appearance) {
      return;
    }
    this.#replaceAppearance(appearance);
  }

  get selected(): string | null {
    return this.manager.selected;
  }

  get hovered(): string | null {
    return this.manager.hovered;
  }

  register(
    id: string,
    target: SelectableObject,
    options: { technique?: SelectionTechnique; } = {}
  ): void {
    this.#assertActive();
    this.manager.register(id, target, options);
  }

  unregister(
    id: string
  ): void {
    this.#assertActive();
    this.manager.unregister(id);
  }

  select(
    id: string | null
  ): void {
    this.#assertActive();
    this.manager.select(id);
  }

  hover(
    id: string | null
  ): void {
    this.#assertActive();
    this.manager.hover(id);
  }

  configure(
    appearance: SelectionAppearanceOptions
  ): void {
    this.#assertActive();
    this.appearance = this.manager.appearance.with(appearance);
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

    this.manager.removeEventListener("change", this.#onManagerChange);
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
    this.manager.dispose();
    this.peerSelections.dispose();
    this.peerHovers.dispose();
    this.dispatchEvent(new Event("dispose"));
  }

  #replaceAppearance(
    nextAppearance: SelectionAppearance
  ): void {
    const previousAppearance = this.manager.appearance;
    const next = this.#createRenderer(this.#mode, nextAppearance);
    this.#synchronize = false;
    try {
      this.manager.appearance = nextAppearance;
      next.sync(this.#resolver.resolve(), this.manager.appearance);
    }
    catch (error) {
      next.dispose();
      this.manager.appearance = previousAppearance;
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
      throw new Error("SelectionSystem has been disposed");
    }
  }

  #sync(): void {
    if (!this.#synchronize || this.#disposed) {
      return;
    }
    this.#presentation.sync(
      this.#resolver.resolve(),
      this.manager.appearance
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
    detail: SelectionSystemChangeEventDetail
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
    mode: SelectionRenderMode,
    appearance = this.manager.appearance
  ): SelectionRenderer {
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
      return new ObjectOverlaySelectionRenderer({
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

    return new HighlightSelectionRenderer({
      highlight,
      overlayRegistry: this.#overlayRegistry
    });
  }
}
