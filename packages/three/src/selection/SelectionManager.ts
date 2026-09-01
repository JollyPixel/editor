// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { createSelectionOverlay, type SelectionOverlay } from "./overlays/createSelectionOverlay.ts";

export type SelectableObject = THREE.Mesh | THREE.Object3D;

/**
 * Which technique a registered object renders when selected/hovered. A
 * non-mesh target (e.g. a `THREE.Group`) always renders `SelectionBoundingBox`
 * regardless of this setting - a group's selection indicator stays the same
 * line-segment box no matter which technique is active. Under `"highlight"`/
 * `"highlightJfa"` this box renders *alongside*, not instead of, the
 * scene-level per-mesh colored highlight a `PeerHighlightPass`/equivalent
 * still draws for that same group (see its own doc comment) - deliberately
 * both at once, one technique per group is not a design goal here.
 * - `"outline"` - `SelectionOutline`, a clean silhouette via `THREE.EdgesGeometry`,
 *   cheap and pipeline-free (composes with any host render pipeline, unlike
 *   `"highlight"`/`"highlightJfa"` below).
 * - `"highlight"` - `HighlightPass`, a scene-level postprocess outline (a
 *   blurred edge map) instead of a per-object overlay child.
 * - `"highlightJfa"` - `HighlightPassJfa`, the same scene-level postprocess
 *   concept as `"highlight"`, but a Jump Flood Algorithm distance field
 *   instead of a blurred edge map - a real per-pixel distance to the
 *   silhouette, so the ring reads the same width regardless of viewing angle
 *   or downsample level (see its own doc comment for the trade-off).
 *
 *   For either scene-level technique, `SelectionManager` itself never owns
 *   or drives the actual pass - resolving an id to one just skips building a
 *   local overlay for it (see `#applySelectedOverlay`/`isScenePipelineTechnique`);
 *   actually rendering anything requires a separate `PeerHighlightPass` (even
 *   with zero peers registered) or equivalent reading this manager's
 *   `selected`/`hovered`/`color`/`hoverColor` and driving a `HighlightPass`/
 *   `HighlightPassJfa` itself. Misconfiguring this - choosing one of these
 *   with nothing actually wired up - fails silently (no visible feedback, no
 *   thrown error), unlike every other technique here; this manager holds no
 *   reference to any pipeline object to loudly check against.
 *
 * These three are only the built-in ids, kept as literals here for
 * autocomplete/documentation - not exhaustive. `"outline"` resolves through
 * `defaultSelectionOverlayRegistry` (`overlays/createSelectionOverlay.ts`),
 * which a caller can register additional per-object techniques into (see
 * `SelectionOverlayRegistry`'s own doc comment); any registered id is a legal
 * `SelectionTechnique` value here too, hence the trailing `(string & {})`
 * branch, which keeps editor autocomplete for the known literals without
 * rejecting an id this type doesn't know about.
 */
export type SelectionTechnique = "outline" | "highlight" | "highlightJfa" | (string & {});

/**
 * Every `SelectionTechnique` that's a scene-level pipeline rather than a
 * per-object overlay (see `SelectionTechnique`'s own doc comment on
 * `"highlight"`/`"highlightJfa"`) - both resolve the same way everywhere
 * this manager cares about the distinction (skip the local overlay; a peer
 * overlay falls back to `"outline"` instead, see `PeerSelectionOverlays`),
 * so this is the single place that list is kept, rather than repeating the
 * two-way check at every call site.
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
   * Default `SelectionOutline` tuning applied to every mesh rendered with
   * the `"outline"` technique. Fields left unset here fall back to
   * `SelectionOutlineOptions`'s own defaults. Adjustable at runtime via
   * `setOutlineOptions`.
   */
  outline?: { linewidth?: number; };
  /**
   * Default `SelectionBoundingBox` tuning applied to every group (any
   * registered non-mesh target - `SelectionBoundingBox` is what such a
   * target always renders, regardless of `technique`). Fields left unset
   * here fall back to `SelectionBoundingBoxOptions`'s own defaults.
   * Adjustable at runtime via `setBoundingBoxOptions`.
   */
  boundingBox?: { fillOpacity?: number; };
  /**
   * Skips the depth test (and depth write) on the selection/hover overlay so
   * it stays visible through any geometry in front of it, like an X-ray,
   * instead of being occluded like a normal object - handy for keeping a
   * selection visible through walls or a crowded scene. Applies uniformly
   * regardless of `technique`/per-id `technique` (`SelectionOutline` and a
   * group's `SelectionBoundingBox` both support it). Adjustable at runtime
   * via `setXray`.
   * @default false
   */
  xray?: boolean;
}

/**
 * Tracks a single selected id and a single hovered id across a pool of
 * registered objects, rendering a `SelectionOutline` (per `SelectionTechnique`)
 * for a `THREE.Mesh`, or always a `SelectionBoundingBox` for anything else
 * (typically a `THREE.Group`) - callers never need to know which technique a
 * given id resolves to.
 *
 * `"outline"` (and every non-mesh id, regardless of technique) is a
 * per-object overlay child this class builds and disposes itself as
 * selection/hover changes; `"highlight"`/`"highlightJfa"` are scene-level
 * pipelines instead, entirely outside this class - see
 * `SelectionTechnique`'s own doc comment on those ids for what driving one
 * actually requires.
 *
 * Objects are addressed by a caller-assigned string id rather than by
 * object reference so that a UI outside the 3D view (e.g. a `TreeView` from
 * `@jolly-pixel/arbor`) can drive selection without holding onto
 * `THREE.Object3D` instances itself - it only needs to agree on ids.
 * Dispatches plain `Event`s (`selectionChange`, `hoverChange`) rather than
 * `CustomEvent`s, matching `TreeView`'s own `selectionChange` event: state is
 * read back via the `selected`/`hovered` getters, not the event.
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
   * Current color used for the full-opacity "selected" overlay - see `color`
   * on `SelectionManagerOptions`.
   */
  get color(): THREE.ColorRepresentation {
    return this.#color;
  }

  /**
   * Current color used for the dimmer "hover" overlay - see `hoverColor` on
   * `SelectionManagerOptions`.
   */
  get hoverColor(): THREE.ColorRepresentation {
    return this.#hoverColor;
  }

  /**
   * Current opacity used for the dimmer "hover" overlay - see `hoverOpacity`
   * on `SelectionManagerOptions`.
   */
  get hoverOpacity(): number {
    return this.#hoverOpacity;
  }

  /**
   * Updates the color of the full-opacity "selected" overlay (e.g. from a
   * settings panel) and immediately rebuilds the active selection overlay so
   * the change is visible without reselecting. The hover overlay is
   * unaffected.
   */
  setColor(
    color: THREE.ColorRepresentation
  ): void {
    this.#color = color;
    this.#selectedOverlay?.setColor(color);
  }

  /**
   * Updates the color of the dimmer "hover" overlay and immediately
   * refreshes the active hover overlay (if any and not currently suppressed
   * by a matching selection) so the change is visible without re-hovering.
   */
  setHoverColor(
    color: THREE.ColorRepresentation
  ): void {
    this.#hoverColor = color;
    this.#hoverOverlay?.setColor(color);
  }

  /**
   * Updates the opacity of the dimmer "hover" overlay and immediately
   * refreshes the active hover overlay (if any and not currently suppressed
   * by a matching selection) so the change is visible without re-hovering.
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
   * Default overlay technique for registered meshes - see `technique` on
   * `SelectionManagerOptions`. A group's `SelectionBoundingBox` never
   * depends on this.
   */
  get technique(): SelectionTechnique {
    return this.#technique;
  }

  /**
   * Switches the manager's mesh overlay technique for every mesh - including
   * ids registered with their own per-id `technique` override via `register`,
   * which this drops - and immediately rebuilds the active selection/hover
   * overlays so the change is visible without needing to reselect anything.
   * A per-id override can be reinstated afterward with a fresh `register`
   * call, until the next `setTechnique`.
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
   * Current default `SelectionOutline` tuning - see `outline` on
   * `SelectionManagerOptions`.
   */
  get outlineOptions(): { linewidth?: number; } {
    return { ...this.#outlineOptions };
  }

  /**
   * Merges `options` into the manager's default `SelectionOutline` tuning
   * (e.g. from a settings panel) and immediately rebuilds the active
   * selection/hover overlays so the change is visible without reselecting -
   * same rebuild behavior as `setTechnique`. Only affects an overlay
   * currently rendered with the `"outline"` technique.
   */
  setOutlineOptions(
    options: { linewidth?: number; }
  ): void {
    this.#outlineOptions = { ...this.#outlineOptions, ...options };
    this.#rebuildActiveOverlays();
  }

  /**
   * Current default `SelectionBoundingBox` tuning - see `boundingBox` on
   * `SelectionManagerOptions`.
   */
  get boundingBoxOptions(): { fillOpacity?: number; } {
    return { ...this.#boundingBoxOptions };
  }

  /**
   * Merges `options` into the manager's default `SelectionBoundingBox`
   * tuning (e.g. from a settings panel) and immediately rebuilds the active
   * selection/hover overlays so the change is visible without reselecting -
   * same rebuild behavior as `setOutlineOptions`. Only affects a currently
   * rendered group overlay (a non-mesh target always renders
   * `SelectionBoundingBox`, regardless of `technique`).
   */
  setBoundingBoxOptions(
    options: { fillOpacity?: number; }
  ): void {
    this.#boundingBoxOptions = { ...this.#boundingBoxOptions, ...options };
    this.#rebuildActiveOverlays();
  }

  /**
   * Current X-ray state - see `xray` on `SelectionManagerOptions`.
   */
  get xray(): boolean {
    return this.#xray;
  }

  /**
   * Toggles X-ray (see `xray` on `SelectionManagerOptions`) and immediately
   * updates the active selection/hover overlays in place - cheap, like
   * `setColor`, since every overlay class's own `setXray` just flips
   * material flags/render order rather than rebuilding geometry.
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
   * Resolves the overlay technique `id` would render with: its own per-id
   * override if `register` was given one, otherwise the manager's
   * `technique` default. Exposed so `PeerSelectionOverlays` can build
   * matching overlays for remote peer selections via
   * `createSelectionOverlay` without duplicating this resolution.
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
   * Rebuilds the active selection/hover overlays in place, so a runtime
   * tuning change (`setTechnique`, `setOutlineOptions`) is visible
   * immediately without needing to reselect anything. `setColor`/etc. don't
   * need this - they update the existing overlay in place instead.
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
   * Clears whatever the "selected" slot currently holds (a disposable
   * overlay, or nothing) and, if `id` isn't `null`, re-applies it per `id`'s
   * resolved technique - a scene-level pipeline technique
   * (`isScenePipelineTechnique`) skips building a local overlay entirely,
   * since that technique is a scene-level pipeline outside this class's own
   * model (see `SelectionTechnique`'s own doc comment). Only for a
   * `THREE.Mesh` target though - a non-mesh one (typically a `THREE.Group`)
   * always gets a `SelectionBoundingBox` instead, the same fallback
   * `"outline"` already gets, so a group's selection indicator stays the
   * same line-segment box regardless of technique.
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

    // A scene-level pipeline technique only reaches here for a non-mesh
    // target (see `#applySelectedOverlay`/`#applyHoverOverlay`) -
    // `createSelectionOverlay` falls back to `SelectionBoundingBox` for those
    // regardless of `technique`, same as `"outline"`.
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
