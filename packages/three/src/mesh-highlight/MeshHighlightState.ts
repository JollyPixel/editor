// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { HighlightOverlay } from "./overlays/HighlightOverlay.ts";
import type { HighlightOverlayRegistry } from "./overlays/HighlightOverlayRegistry.ts";
import { createDefaultHighlightOverlayRegistry } from "./overlays/builtinHighlightOverlayFactories.ts";
import {
  MeshHighlightAppearance,
  type MeshHighlightAppearanceOptions
} from "./MeshHighlightAppearance.ts";

export type SelectableObject = THREE.Object3D;

export type HighlightTechnique =
  | "outline"
  | "boxSilhouette"
  | "highlight"
  | "highlightJfa"
  | (string & {});

const SCENE_PIPELINE_TECHNIQUES = new Set<HighlightTechnique>(["highlight", "highlightJfa"]);

export function isScenePipelineTechnique(
  technique: HighlightTechnique
): boolean {
  return SCENE_PIPELINE_TECHNIQUES.has(technique);
}

export interface MeshHighlightStateOptions {
  /**
   * Immutable visual configuration.
   */
  appearance?: MeshHighlightAppearance | MeshHighlightAppearanceOptions;
  /**
   * Default overlay technique. `register` can override it per id.
   * @default "outline"
   */
  technique?: HighlightTechnique;
  /**
   * Overlay factories this manager resolves its techniques against. Pass a
   * registry of your own to add or replace a technique for this manager
   * alone.
   * @default a registry holding every built-in technique
   */
  overlayRegistry?: HighlightOverlayRegistry;
  /**
   * Disables the legacy local object-overlay presenter. State and events stay
   * active so another renderer can present the manager.
   * @default true
   */
  renderOverlays?: boolean;
}

export type MeshHighlightStateChangeKind =
  | "selection"
  | "hover"
  | "emphasis"
  | "targets"
  | "appearance"
  | "technique";

export interface MeshHighlightStateChangeEventDetail {
  kind: MeshHighlightStateChangeKind;
  objectIds: readonly string[];
}

export interface MeshHighlightStateEventMap {
  selectionChange: Event;
  hoverChange: Event;
  emphasisChange: CustomEvent<MeshHighlightStateChangeEventDetail>;
  targetsChange: CustomEvent<MeshHighlightStateChangeEventDetail>;
  appearanceChange: CustomEvent<MeshHighlightStateChangeEventDetail>;
  techniqueChange: CustomEvent<MeshHighlightStateChangeEventDetail>;
  change: CustomEvent<MeshHighlightStateChangeEventDetail>;
  dispose: Event;
}

export interface MeshHighlightState {
  addEventListener<TKey extends keyof MeshHighlightStateEventMap>(
    type: TKey,
    listener: (event: MeshHighlightStateEventMap[TKey]) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
  removeEventListener<TKey extends keyof MeshHighlightStateEventMap>(
    type: TKey,
    listener: (event: MeshHighlightStateEventMap[TKey]) => void,
    options?: boolean | EventListenerOptions
  ): void;
}

type OverlayStyle = "selected" | "hovered";

interface StyledOverlay {
  style: OverlayStyle;
  overlay: HighlightOverlay | null;
}

export class MeshHighlightState extends EventTarget {
  #targets = new Map<string, SelectableObject>();
  #techniques = new Map<string, HighlightTechnique>();
  #appearance: MeshHighlightAppearance;
  #technique: HighlightTechnique;
  #overlayRegistry: HighlightOverlayRegistry;
  #renderOverlays: boolean;

  #selectedId: string | null = null;
  #hoveredId: string | null = null;
  #emphasizedIds: ReadonlySet<string> = new Set();
  #overlays = new Map<string, StyledOverlay>();

  constructor(
    options: MeshHighlightStateOptions = {}
  ) {
    super();
    const {
      technique = "outline",
      overlayRegistry = createDefaultHighlightOverlayRegistry(),
      renderOverlays = true
    } = options;

    this.#appearance = options.appearance instanceof MeshHighlightAppearance ?
      options.appearance :
      new MeshHighlightAppearance(options.appearance);
    this.#technique = technique;
    this.#overlayRegistry = overlayRegistry;
    this.#renderOverlays = renderOverlays;
  }

  get overlayRegistry(): HighlightOverlayRegistry {
    return this.#overlayRegistry;
  }

  get selected(): string | null {
    return this.#selectedId;
  }

  get hovered(): string | null {
    return this.#hoveredId;
  }

  get emphasized(): ReadonlySet<string> {
    return this.#emphasizedIds;
  }

  get appearance(): MeshHighlightAppearance {
    return this.#appearance;
  }

  set appearance(
    appearance: MeshHighlightAppearance
  ) {
    if (appearance === this.#appearance) {
      return;
    }

    const previous = this.#appearance;
    this.#appearance = appearance;
    try {
      this.#syncOverlays(this.#styles(), "all");
    }
    catch (error) {
      this.#appearance = previous;
      throw error;
    }
    this.#dispatchChange("appearance");
  }

  configure(
    options: MeshHighlightAppearanceOptions
  ): void {
    this.appearance = this.#appearance.with(options);
  }

  register(
    id: string,
    target: SelectableObject,
    options: { technique?: HighlightTechnique; } = {}
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
      if (this.#overlays.has(id)) {
        this.#syncOverlays(this.#styles(), new Set([id]));
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
    if (this.#emphasizedIds.has(id)) {
      this.emphasize([...this.#emphasizedIds].filter((emphasizedId) => emphasizedId !== id));
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

    this.#syncOverlays(this.#styles({ selectedId: id }));
    const previousId = this.#selectedId;
    this.#selectedId = id;

    this.dispatchEvent(
      new Event("selectionChange")
    );
    this.#dispatchChange("selection", changedIds(previousId, id));
  }

  get technique(): HighlightTechnique {
    return this.#technique;
  }

  set technique(
    technique: HighlightTechnique
  ) {
    if (technique === this.#technique) {
      return;
    }

    const previous = this.#technique;
    this.#technique = technique;
    try {
      this.#syncOverlays(this.#styles(), "all");
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

    this.#syncOverlays(this.#styles({ hoveredId: id }));
    const previousId = this.#hoveredId;
    this.#hoveredId = id;

    this.dispatchEvent(new Event("hoverChange"));
    this.#dispatchChange("hover", changedIds(previousId, id));
  }

  emphasize(
    ids: Iterable<string>
  ): void {
    const next = new Set(ids);
    for (const id of next) {
      this.#requireTarget(id);
    }

    const previous = this.#emphasizedIds;
    const changed = [...symmetricDifference(previous, next)];
    if (changed.length === 0) {
      return;
    }

    this.#syncOverlays(this.#styles({ emphasizedIds: next }));
    this.#emphasizedIds = next;
    this.#dispatchChange("emphasis", changed);
  }

  dispose(): void {
    this.dispatchEvent(new Event("dispose"));
    for (const { overlay } of this.#overlays.values()) {
      overlay?.dispose();
    }
    this.#overlays.clear();
    this.#selectedId = null;
    this.#hoveredId = null;
    this.#emphasizedIds = new Set();
    this.#targets.clear();
    this.#techniques.clear();
  }

  techniqueFor(
    id: string
  ): HighlightTechnique {
    return this.#techniques.get(id) ?? this.#technique;
  }

  targetFor(
    id: string
  ): SelectableObject | undefined {
    return this.#targets.get(id);
  }

  #styles(
    changes: {
      selectedId?: string | null;
      hoveredId?: string | null;
      emphasizedIds?: ReadonlySet<string>;
    } = {}
  ): Map<string, OverlayStyle> {
    const {
      selectedId = this.#selectedId,
      hoveredId = this.#hoveredId,
      emphasizedIds = this.#emphasizedIds
    } = changes;
    const styles = new Map<string, OverlayStyle>();
    for (const id of emphasizedIds) {
      styles.set(id, "hovered");
    }
    if (hoveredId !== null) {
      styles.set(hoveredId, "hovered");
    }
    if (selectedId !== null) {
      styles.set(selectedId, "selected");
    }

    return styles;
  }

  #syncOverlays(
    styles: ReadonlyMap<string, OverlayStyle>,
    rebuild: ReadonlySet<string> | "all" = new Set()
  ): void {
    const built = new Map<string, StyledOverlay>();
    try {
      for (const [id, style] of styles) {
        const current = this.#overlays.get(id);
        const stale = rebuild === "all" || rebuild.has(id);
        if (current?.style !== style || stale) {
          built.set(id, {
            style,
            overlay: this.#buildOverlay(id, style)
          });
        }
      }
    }
    catch (error) {
      for (const { overlay } of built.values()) {
        overlay?.dispose();
      }
      throw error;
    }

    const next = new Map<string, StyledOverlay>();
    for (const [id, current] of this.#overlays) {
      if (!styles.has(id) || built.has(id)) {
        current.overlay?.dispose();
      }
    }
    for (const id of styles.keys()) {
      const overlay = built.get(id) ?? this.#overlays.get(id);
      if (overlay !== undefined) {
        next.set(id, overlay);
      }
    }
    this.#overlays = next;
  }

  #buildOverlay(
    id: string,
    state: OverlayStyle
  ): HighlightOverlay | null {
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
  ): HighlightOverlay {
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
      throw new Error(`MeshHighlightState: no object registered for id "${id}"`);
    }

    return target;
  }

  #dispatchChange(
    kind: MeshHighlightStateChangeKind,
    objectIds: readonly string[] = []
  ): void {
    const detail: MeshHighlightStateChangeEventDetail = {
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

function* symmetricDifference(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>
): IterableIterator<string> {
  for (const id of left) {
    if (!right.has(id)) {
      yield id;
    }
  }
  for (const id of right) {
    if (!left.has(id)) {
      yield id;
    }
  }
}
