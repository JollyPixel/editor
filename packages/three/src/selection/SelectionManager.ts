// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { SelectionOverlay } from "./overlays/SelectionOverlay.ts";
import type { SelectionOverlayRegistry } from "./overlays/SelectionOverlayRegistry.ts";
import { createDefaultSelectionOverlayRegistry } from "./overlays/builtinSelectionOverlayFactories.ts";
import {
  SelectionAppearance,
  type SelectionAppearanceOptions
} from "./SelectionAppearance.ts";

export type SelectableObject = THREE.Object3D;

export type SelectionTechnique =
  | "outline"
  | "highlight"
  | "highlightJfa"
  | (string & {});

const SCENE_PIPELINE_TECHNIQUES = new Set<SelectionTechnique>(["highlight", "highlightJfa"]);

export function isScenePipelineTechnique(
  technique: SelectionTechnique
): boolean {
  return SCENE_PIPELINE_TECHNIQUES.has(technique);
}

export interface SelectionManagerOptions {
  /**
   * Immutable visual configuration.
   */
  appearance?: SelectionAppearance | SelectionAppearanceOptions;
  /**
   * Default overlay technique. `register` can override it per id.
   * @default "outline"
   */
  technique?: SelectionTechnique;
  /**
   * Overlay factories this manager resolves its techniques against. Pass a
   * registry of your own to add or replace a technique for this manager
   * alone.
   * @default a registry holding every built-in technique
   */
  overlayRegistry?: SelectionOverlayRegistry;
  /**
   * Disables the legacy local object-overlay presenter. State and events stay
   * active so another renderer can present the manager.
   * @default true
   */
  renderOverlays?: boolean;
}

export type SelectionManagerChangeKind =
  | "selection"
  | "hover"
  | "targets"
  | "appearance"
  | "technique";

export interface SelectionManagerChangeEventDetail {
  kind: SelectionManagerChangeKind;
  objectIds: readonly string[];
}

export interface SelectionManagerEventMap {
  selectionChange: Event;
  hoverChange: Event;
  targetsChange: CustomEvent<SelectionManagerChangeEventDetail>;
  appearanceChange: CustomEvent<SelectionManagerChangeEventDetail>;
  techniqueChange: CustomEvent<SelectionManagerChangeEventDetail>;
  change: CustomEvent<SelectionManagerChangeEventDetail>;
  dispose: Event;
}

export interface SelectionManager {
  addEventListener<TKey extends keyof SelectionManagerEventMap>(
    type: TKey,
    listener: (event: SelectionManagerEventMap[TKey]) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
  removeEventListener<TKey extends keyof SelectionManagerEventMap>(
    type: TKey,
    listener: (event: SelectionManagerEventMap[TKey]) => void,
    options?: boolean | EventListenerOptions
  ): void;
}

export class SelectionManager extends EventTarget {
  #targets = new Map<string, SelectableObject>();
  #techniques = new Map<string, SelectionTechnique>();
  #appearance: SelectionAppearance;
  #technique: SelectionTechnique;
  #overlayRegistry: SelectionOverlayRegistry;
  #renderOverlays: boolean;

  #selectedId: string | null = null;
  #selectedOverlay: SelectionOverlay | null = null;
  #hoveredId: string | null = null;
  #hoverOverlay: SelectionOverlay | null = null;

  constructor(
    options: SelectionManagerOptions = {}
  ) {
    super();
    const {
      technique = "outline",
      overlayRegistry = createDefaultSelectionOverlayRegistry(),
      renderOverlays = true
    } = options;

    this.#appearance = options.appearance instanceof SelectionAppearance ?
      options.appearance :
      new SelectionAppearance(options.appearance);
    this.#technique = technique;
    this.#overlayRegistry = overlayRegistry;
    this.#renderOverlays = renderOverlays;
  }

  get overlayRegistry(): SelectionOverlayRegistry {
    return this.#overlayRegistry;
  }

  get selected(): string | null {
    return this.#selectedId;
  }

  get hovered(): string | null {
    return this.#hoveredId;
  }

  get appearance(): SelectionAppearance {
    return this.#appearance;
  }

  set appearance(
    appearance: SelectionAppearance
  ) {
    if (appearance === this.#appearance) {
      return;
    }

    const previous = this.#appearance;
    this.#appearance = appearance;
    try {
      this.#rebuildActiveOverlays();
    }
    catch (error) {
      this.#appearance = previous;
      throw error;
    }
    this.#dispatchChange("appearance");
  }

  configure(
    options: SelectionAppearanceOptions
  ): void {
    this.appearance = this.#appearance.with(options);
  }

  register(
    id: string,
    target: SelectableObject,
    options: { technique?: SelectionTechnique; } = {}
  ): void {
    const previousTarget = this.#targets.get(id);
    const previousTechnique = this.#techniques.get(id);
    this.#targets.set(id, target);

    if (options.technique) {
      this.#techniques.set(id, options.technique);
    }
    else {
      this.#techniques.delete(id);
    }

    try {
      if (id === this.#selectedId || id === this.#hoveredId) {
        this.#rebuildActiveOverlays();
      }
    }
    catch (error) {
      if (previousTarget) {
        this.#targets.set(id, previousTarget);
      }
      else {
        this.#targets.delete(id);
      }
      if (previousTechnique) {
        this.#techniques.set(id, previousTechnique);
      }
      else {
        this.#techniques.delete(id);
      }
      throw error;
    }

    this.#dispatchChange("targets", [id]);
  }

  unregister(
    id: string
  ): void {
    if (this.#selectedId === id) {
      this.select(null);
    }
    if (this.#hoveredId === id) {
      this.hover(null);
    }
    this.#targets.delete(id);
    this.#techniques.delete(id);
    this.#dispatchChange("targets", [id]);
  }

  select(
    id: string | null
  ): void {
    if (id === this.#selectedId) {
      return;
    }

    const selectedOverlay = this.#buildOverlay(id, "selected");
    let hoverOverlay: SelectionOverlay | null;
    try {
      hoverOverlay = this.#buildOverlay(
        id === this.#hoveredId ? null : this.#hoveredId,
        "hovered"
      );
    }
    catch (error) {
      selectedOverlay?.dispose();
      throw error;
    }
    const previousId = this.#selectedId;
    const previousSelectedOverlay = this.#selectedOverlay;
    const previousHoverOverlay = this.#hoverOverlay;

    this.#selectedId = id;
    this.#selectedOverlay = selectedOverlay;
    this.#hoverOverlay = hoverOverlay;
    previousSelectedOverlay?.dispose();
    previousHoverOverlay?.dispose();

    this.dispatchEvent(
      new Event("selectionChange")
    );
    this.#dispatchChange("selection", changedIds(previousId, id));
  }

  get technique(): SelectionTechnique {
    return this.#technique;
  }

  set technique(
    technique: SelectionTechnique
  ) {
    if (technique === this.#technique) {
      return;
    }

    const previous = this.#technique;
    this.#technique = technique;
    try {
      this.#rebuildActiveOverlays();
    }
    catch (error) {
      this.#technique = previous;
      throw error;
    }
    this.#dispatchChange("technique");
  }

  hover(
    id: string | null
  ): void {
    if (id === this.#hoveredId) {
      return;
    }

    const overlay = this.#buildOverlay(
      id !== null && id !== this.#selectedId ? id : null,
      "hovered"
    );
    const previousId = this.#hoveredId;
    const previousOverlay = this.#hoverOverlay;

    this.#hoveredId = id;
    this.#hoverOverlay = overlay;
    previousOverlay?.dispose();

    this.dispatchEvent(new Event("hoverChange"));
    this.#dispatchChange("hover", changedIds(previousId, id));
  }

  dispose(): void {
    this.dispatchEvent(new Event("dispose"));
    this.#selectedOverlay?.dispose();
    this.#hoverOverlay?.dispose();
    this.#selectedOverlay = null;
    this.#hoverOverlay = null;
    this.#selectedId = null;
    this.#hoveredId = null;
    this.#targets.clear();
    this.#techniques.clear();
  }

  techniqueFor(
    id: string
  ): SelectionTechnique {
    return this.#techniques.get(id) ?? this.#technique;
  }

  targetFor(
    id: string
  ): SelectableObject | undefined {
    return this.#targets.get(id);
  }

  #rebuildActiveOverlays(): void {
    let selectedOverlay: SelectionOverlay | null = null;
    let hoverOverlay: SelectionOverlay | null = null;

    try {
      selectedOverlay = this.#buildOverlay(this.#selectedId, "selected");
      const hoveredId = this.#hoveredId === this.#selectedId ?
        null : this.#hoveredId;
      hoverOverlay = this.#buildOverlay(
        hoveredId,
        "hovered"
      );
    }
    catch (error) {
      selectedOverlay?.dispose();
      hoverOverlay?.dispose();
      throw error;
    }

    this.#selectedOverlay?.dispose();
    this.#hoverOverlay?.dispose();
    this.#selectedOverlay = selectedOverlay;
    this.#hoverOverlay = hoverOverlay;
  }

  #buildOverlay(
    id: string | null,
    state: "selected" | "hovered"
  ): SelectionOverlay | null {
    if (id === null) {
      return null;
    }

    const target = this.#requireTarget(id);
    if (
      !this.#renderOverlays ||
      (isScenePipelineTechnique(this.techniqueFor(id)) &&
        target instanceof THREE.Mesh)
    ) {
      return null;
    }

    const indicator = this.#appearance[state];

    return this.#createOverlay(
      id,
      indicator.color,
      indicator.opacity
    );
  }

  #createOverlay(
    id: string,
    color: THREE.ColorRepresentation,
    opacity: number
  ): SelectionOverlay {
    const target = this.#requireTarget(id);
    const technique = this.techniqueFor(id);

    return this.#overlayRegistry.create(target, {
      technique,
      color,
      opacity,
      linewidth: this.#appearance.outline.linewidth,
      fillOpacity: this.#appearance.bounds.fillOpacity,
      xray: this.#appearance.xray
    });
  }

  #requireTarget(
    id: string
  ): SelectableObject {
    const target = this.#targets.get(id);
    if (!target) {
      throw new Error(`SelectionManager: no object registered for id "${id}"`);
    }

    return target;
  }

  #dispatchChange(
    kind: SelectionManagerChangeKind,
    objectIds: readonly string[] = []
  ): void {
    const detail: SelectionManagerChangeEventDetail = {
      kind,
      objectIds: [...objectIds]
    };
    if (kind !== "selection" && kind !== "hover") {
      this.dispatchEvent(new CustomEvent(`${kind}Change`, { detail }));
    }
    this.dispatchEvent(new CustomEvent("change", { detail }));
  }
}

function changedIds(
  previousId: string | null,
  nextId: string | null
): string[] {
  return [...new Set([previousId, nextId].filter((id) => id !== null))];
}
