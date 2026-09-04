// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { createSelectionOverlay, type SelectionOverlay } from "./overlays/createSelectionOverlay.ts";

export type SelectableObject = THREE.Mesh | THREE.Object3D;

/**
 * Which technique a registered object renders when selected/hovered.
 * A non-mesh target (e.g. a `THREE.Group`) always renders
 * `SelectionBoundingBox` instead, regardless of this setting.
 *
 * - `"outline"` - `SelectionOutline`, a per-object overlay, cheap and
 *   pipeline-free.
 * - `"highlight"` / `"highlightJfa"` - `HighlightPass` / `HighlightPassJfa`,
 *   scene-level postprocess passes instead of a per-object overlay.
 *   `SelectionManager` only resolves ids to these; it never drives the pass
 *   itself, so nothing renders until a `PeerHighlightPass` (or equivalent)
 *   is wired up separately - misconfiguring this fails silently, with no
 *   thrown error.
 *
 * These three are only the built-in ids. `"outline"` resolves through
 * `defaultSelectionOverlayRegistry` (`overlays/createSelectionOverlay.ts`),
 * which a caller can register further per-object techniques into (see
 * `SelectionOverlayRegistry`) - hence the trailing `(string & {})` branch,
 * keeping autocomplete for known literals without rejecting an id this type
 * doesn't know about.
 */
export type SelectionTechnique = "outline" | "highlight" | "highlightJfa" | (string & {});

/**
 * Every scene-level pipeline technique (see `SelectionTechnique`) - kept as
 * a single set so the check isn't repeated at every call site.
 */
const SCENE_PIPELINE_TECHNIQUES = new Set<SelectionTechnique>(["highlight", "highlightJfa"]);

export function isScenePipelineTechnique(
  technique: SelectionTechnique
): boolean {
  return SCENE_PIPELINE_TECHNIQUES.has(technique);
}

export interface SelectionManagerOptions {
  /**
   * @default "#ffffff"
   */
  color?: THREE.ColorRepresentation;
  /**
   * @default "#8ab4f8"
   */
  hoverColor?: THREE.ColorRepresentation;
  /**
   * @default 0.35
   */
  hoverOpacity?: number;
  /**
   * Default overlay technique for registered meshes, used unless overridden
   * per-id via `register`'s own `technique` option.
   * @default "outline"
   */
  technique?: SelectionTechnique;
  /**
   * Default `SelectionOutline` tuning for meshes rendered with the
   * `"outline"` technique. Adjustable at runtime via `setOutlineOptions`.
   */
  outline?: { linewidth?: number; };
  /**
   * Default `SelectionBoundingBox` tuning for any group (a non-mesh target
   * always renders `SelectionBoundingBox`, regardless of `technique`).
   * Adjustable at runtime via `setBoundingBoxOptions`.
   */
  boundingBox?: { fillOpacity?: number; };
  /**
   * Skips depth test/write on the selection/hover overlay so it stays
   * visible through other geometry, like an X-ray. Applies to both
   * `SelectionOutline` and `SelectionBoundingBox`. Adjustable at runtime via
   * `setXray`.
   * @default false
   */
  xray?: boolean;
}

/**
 * Tracks a single selected id and a single hovered id across a pool of
 * registered objects, rendering a `SelectionOutline`/`SelectionBoundingBox`
 * per `SelectionTechnique` - callers never need to know which technique a
 * given id resolves to.
 *
 * `"outline"` (and every non-mesh id) builds a per-object overlay this
 * class owns and disposes; `"highlight"`/`"highlightJfa"` are scene-level
 * pipelines outside this class (see `SelectionTechnique`).
 *
 * Objects are addressed by a caller-assigned string id, not object
 * reference, so a UI outside the 3D view (e.g. a `TreeView` from
 * `@jolly-pixel/arbor`) can drive selection without holding onto
 * `THREE.Object3D` instances. Dispatches plain `Event`s (`selectionChange`,
 * `hoverChange`); state is read back via the `selected`/`hovered` getters.
 */
export class SelectionManager extends EventTarget {
  #targets = new Map<string, SelectableObject>();
  #techniques = new Map<string, SelectionTechnique>();
  #color: THREE.ColorRepresentation;
  #hoverColor: THREE.ColorRepresentation;
  #hoverOpacity: number;
  #technique: SelectionTechnique;
  #outlineOptions: { linewidth?: number; };
  #boundingBoxOptions: { fillOpacity?: number; };
  #xray: boolean;

  #selectedId: string | null = null;
  #selectedOverlay: SelectionOverlay | null = null;
  #hoveredId: string | null = null;
  #hoverOverlay: SelectionOverlay | null = null;

  constructor(
    options: SelectionManagerOptions = {}
  ) {
    super();

    this.#color = options.color ?? "#ffffff";
    this.#hoverColor = options.hoverColor ?? "#8ab4f8";
    this.#hoverOpacity = options.hoverOpacity ?? 0.35;
    this.#technique = options.technique ?? "outline";
    this.#outlineOptions = { ...options.outline };
    this.#boundingBoxOptions = { ...options.boundingBox };
    this.#xray = options.xray ?? false;
  }

  get selected(): string | null {
    return this.#selectedId;
  }

  get hovered(): string | null {
    return this.#hoveredId;
  }

  /**
   * Current color of the full-opacity "selected" overlay.
   */
  get color(): THREE.ColorRepresentation {
    return this.#color;
  }

  /**
   * Current color of the dimmer "hover" overlay.
   */
  get hoverColor(): THREE.ColorRepresentation {
    return this.#hoverColor;
  }

  /**
   * Current opacity of the dimmer "hover" overlay.
   */
  get hoverOpacity(): number {
    return this.#hoverOpacity;
  }

  /**
   * Updates the selected overlay's color and reapplies it immediately,
   * without needing to reselect. Doesn't affect the hover overlay.
   */
  setColor(
    color: THREE.ColorRepresentation
  ): void {
    this.#color = color;
    this.#selectedOverlay?.setColor(color);
  }

  /**
   * Updates the hover overlay's color and reapplies it immediately,
   * without needing to re-hover.
   */
  setHoverColor(
    color: THREE.ColorRepresentation
  ): void {
    this.#hoverColor = color;
    this.#hoverOverlay?.setColor(color);
  }

  /**
   * Updates the hover overlay's opacity and reapplies it immediately,
   * without needing to re-hover.
   */
  setHoverOpacity(
    opacity: number
  ): void {
    this.#hoverOpacity = opacity;
    this.#hoverOverlay?.setOpacity(opacity);
  }

  register(
    id: string,
    target: SelectableObject,
    options: { technique?: SelectionTechnique; } = {}
  ): void {
    this.#targets.set(id, target);

    if (options.technique) {
      this.#techniques.set(id, options.technique);
    }
    else {
      this.#techniques.delete(id);
    }
  }

  /**
   * Drops `id` from the registry, clearing selection/hover overlays first if
   * `id` currently holds either.
   */
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
  }

  select(
    id: string | null
  ): void {
    if (id === this.#selectedId) {
      return;
    }

    this.#selectedId = id;
    this.#applySelectedOverlay(id);

    // Selected already reads as outlined - no need for a dimmer hover overlay underneath.
    if (id !== null && this.#hoveredId === id) {
      this.#applyHoverOverlay(null);
    }

    this.dispatchEvent(new Event("selectionChange"));
  }

  /**
   * Default overlay technique for registered meshes. A group's
   * `SelectionBoundingBox` never depends on this.
   */
  get technique(): SelectionTechnique {
    return this.#technique;
  }

  /**
   * Switches the default mesh technique, dropping any per-id override
   * `register` set, and rebuilds active overlays so the change is visible
   * immediately. A per-id override can be reinstated with a fresh
   * `register` call.
   */
  setTechnique(
    technique: SelectionTechnique
  ): void {
    const changed = technique !== this.#technique || this.#techniques.size > 0;
    this.#technique = technique;
    this.#techniques.clear();

    if (!changed) {
      return;
    }

    this.#rebuildActiveOverlays();
  }

  /**
   * Current default `SelectionOutline` tuning.
   */
  get outlineOptions(): { linewidth?: number; } {
    return { ...this.#outlineOptions };
  }

  /**
   * Merges into the default `SelectionOutline` tuning and rebuilds active
   * overlays immediately. Only affects overlays currently using
   * `"outline"`.
   */
  setOutlineOptions(
    options: { linewidth?: number; }
  ): void {
    this.#outlineOptions = { ...this.#outlineOptions, ...options };
    this.#rebuildActiveOverlays();
  }

  /**
   * Current default `SelectionBoundingBox` tuning.
   */
  get boundingBoxOptions(): { fillOpacity?: number; } {
    return { ...this.#boundingBoxOptions };
  }

  /**
   * Merges into the default `SelectionBoundingBox` tuning and rebuilds
   * active overlays immediately. Only affects a currently rendered group
   * overlay.
   */
  setBoundingBoxOptions(
    options: { fillOpacity?: number; }
  ): void {
    this.#boundingBoxOptions = { ...this.#boundingBoxOptions, ...options };
    this.#rebuildActiveOverlays();
  }

  /**
   * Current X-ray state.
   */
  get xray(): boolean {
    return this.#xray;
  }

  /**
   * Toggles X-ray and updates active overlays in place - cheap, since
   * `setXray` just flips material flags rather than rebuilding geometry.
   */
  setXray(
    xray: boolean
  ): void {
    this.#xray = xray;
    this.#selectedOverlay?.setXray(xray);
    if (this.#hoveredId !== null && this.#hoveredId !== this.#selectedId) {
      this.#hoverOverlay?.setXray(xray);
    }
  }

  hover(
    id: string | null
  ): void {
    if (id === this.#hoveredId) {
      return;
    }

    this.#hoveredId = id;
    this.#applyHoverOverlay(id !== null && id !== this.#selectedId ? id : null);

    this.dispatchEvent(new Event("hoverChange"));
  }

  /**
   * Disposes any active overlays and forgets every registered id. The
   * manager can be reused afterward via `register`.
   */
  dispose(): void {
    this.select(null);
    this.hover(null);
    this.#targets.clear();
    this.#techniques.clear();
  }

  /**
   * Resolves the technique `id` renders with: its own `register` override,
   * or the manager's default. Exposed so `PeerSelectionOverlays` can build
   * matching overlays for peer selections without duplicating this
   * resolution.
   */
  techniqueFor(
    id: string
  ): SelectionTechnique {
    return this.#techniques.get(id) ?? this.#technique;
  }

  /**
   * The object registered for `id`, or `undefined` if none is.
   */
  targetFor(
    id: string
  ): SelectableObject | undefined {
    return this.#targets.get(id);
  }

  /**
   * Rebuilds active overlays in place so a runtime tuning change
   * (`setTechnique`, `setOutlineOptions`, ...) is visible without
   * reselecting. `setColor`/etc. update the existing overlay in place
   * instead and don't need this.
   */
  #rebuildActiveOverlays(): void {
    if (this.#selectedId !== null) {
      this.#applySelectedOverlay(this.#selectedId);
    }
    if (this.#hoveredId !== null && this.#hoveredId !== this.#selectedId) {
      this.#applyHoverOverlay(this.#hoveredId);
    }
  }

  /**
   * Clears the current "selected" overlay and, if `id` isn't `null`,
   * rebuilds it per its resolved technique. A scene-level pipeline
   * technique skips building a local overlay for a mesh target (rendered
   * externally instead); a non-mesh target always gets a
   * `SelectionBoundingBox` regardless of technique.
   */
  #applySelectedOverlay(
    id: string | null
  ): void {
    this.#selectedOverlay?.dispose();
    this.#selectedOverlay = null;

    if (id === null) {
      return;
    }

    const target = this.#requireTarget(id);
    if (isScenePipelineTechnique(this.techniqueFor(id)) && target instanceof THREE.Mesh) {
      return;
    }

    this.#selectedOverlay = this.#createOverlay(id, this.#color, 1);
  }

  /**
   * Same as `#applySelectedOverlay`, for the "hover" slot.
   */
  #applyHoverOverlay(
    id: string | null
  ): void {
    this.#hoverOverlay?.dispose();
    this.#hoverOverlay = null;

    if (id === null) {
      return;
    }

    const target = this.#requireTarget(id);
    if (isScenePipelineTechnique(this.techniqueFor(id)) && target instanceof THREE.Mesh) {
      return;
    }

    this.#hoverOverlay = this.#createOverlay(id, this.#hoverColor, this.#hoverOpacity);
  }

  #createOverlay(
    id: string,
    color: THREE.ColorRepresentation,
    opacity: number
  ): SelectionOverlay {
    const target = this.#requireTarget(id);
    const technique = this.techniqueFor(id);

    // Reached for a non-mesh target even when the technique is scene-level -
    // `createSelectionOverlay` falls back to `SelectionBoundingBox` there too.
    return createSelectionOverlay(target, {
      technique,
      color,
      opacity,
      linewidth: this.#outlineOptions.linewidth,
      fillOpacity: this.#boundingBoxOptions.fillOpacity,
      xray: this.#xray
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
}
