// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { createSelectionOverlay, type SelectionOverlay } from "./overlays/createSelectionOverlay.ts";
import type { ToonOutlinePass } from "./postprocess/ToonOutlinePass.ts";

export type SelectableObject = THREE.Mesh | THREE.Object3D;

/**
 * Which technique a registered object renders when selected/hovered. A
 * non-mesh target (e.g. a `THREE.Group`) always renders `SelectionBoundingBox`
 * regardless of this setting - a group's selection indicator stays the same
 * line-segment box no matter which style is active.
 * - `"outline"` - `SelectionOutline`, a clean silhouette on low-poly/hard-surface
 *   meshes, but busy on smooth/high-poly ones.
 * - `"highlight"` - `SelectionHighlight`, an inverted-hull rim that reads
 *   cleanly on any mesh regardless of complexity.
 * - `"toonOutline"` - `ToonOutlinePass`, a scene-level postprocess outline
 *   (see its own doc comment) instead of a per-object overlay child.
 *   Requires a `ToonOutlinePass` passed via `SelectionManagerOptions.toonOutline`
 *   - resolving to this style for a mesh without one set throws.
 */
export type MeshSelectionStyle = "outline" | "highlight" | "toonOutline";

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
   * Default overlay style for registered meshes, used unless overridden
   * per-id via `register`'s own `style` option.
   * @default "outline"
   */
  meshStyle?: MeshSelectionStyle;
  /**
   * Default `SelectionOutline` tuning applied to every mesh rendered with
   * the `"outline"` style. Fields left unset here fall back to
   * `SelectionOutlineOptions`'s own defaults. Adjustable at runtime via
   * `setOutlineOptions`.
   */
  outline?: { linewidth?: number; };
  /**
   * Default `SelectionHighlight` tuning applied to every mesh rendered with
   * the `"highlight"` style. Fields left unset here fall back to
   * `SelectionHighlightOptions`'s own defaults. Adjustable at runtime via
   * `setHighlightOptions`.
   */
  highlight?: { thickness?: number; };
  /**
   * The pipeline driving the `"toonOutline"` style, if any - not owned by
   * `SelectionManager` (never disposed by it), only pushed to. Required for
   * any registered mesh id to actually resolve to `"toonOutline"` (via
   * `meshStyle` or a per-id `register` override); resolving without one set
   * throws. A non-mesh id (e.g. a `THREE.Group`) never needs this - it
   * always renders `SelectionBoundingBox` regardless of style.
   * `color`/`hoverColor`/`hoverOpacity`/`xray` below apply to it the same as
   * to the per-object overlay styles, kept in sync automatically.
   */
  toonOutline?: ToonOutlinePass;
  /**
   * Default `ToonOutlinePass` tuning applied whenever `toonOutline` above is
   * set. Fields left unset here fall back to `ToonOutlinePassOptions`'s own
   * defaults. Adjustable at runtime via `setToonOutlineOptions`.
   */
  toonOutlineOptions?: { edgeThickness?: number; hiddenColor?: THREE.ColorRepresentation; };
  /**
   * Skips the depth test (and depth write) on the selection/hover overlay so
   * it stays visible through any geometry in front of it, like an X-ray,
   * instead of being occluded like a normal object - handy for keeping a
   * selection visible through walls or a crowded scene. Applies uniformly
   * regardless of `meshStyle`/per-id `style` (`SelectionOutline`,
   * `SelectionHighlight`, a group's `SelectionBoundingBox`, and
   * `ToonOutlinePass` all support it). Adjustable at runtime via `setXray`.
   * @default false
   */
  xray?: boolean;
}

/**
 * Tracks a single selected id and a single hovered id across a pool of
 * registered objects, rendering a `SelectionOutline`/`SelectionHighlight`/
 * driven `ToonOutlinePass` (per `MeshSelectionStyle`) for a `THREE.Mesh`, or
 * always a `SelectionBoundingBox` for anything else (typically a
 * `THREE.Group`) - callers never need to know which technique a given id
 * resolves to.
 *
 * `"outline"`/`"highlight"` (and every non-mesh id, regardless of style) are
 * per-object overlay children this class builds and disposes itself as
 * selection/hover changes; `"toonOutline"` is a scene-level pipeline
 * instead, supplied (not owned) via `SelectionManagerOptions.toonOutline` -
 * this class only ever pushes selected/hovered targets and shared tuning
 * (`color`/`hoverColor`/`hoverOpacity`/`xray`/`toonOutlineOptions`) into it,
 * never constructs or disposes it.
 *
 * Objects are addressed by a caller-assigned string id rather than by
 * object reference so that a UI outside the 3D view (e.g. a `TreeView` from
 * `@jolly-pixel/fs-tree`) can drive selection without holding onto
 * `THREE.Object3D` instances itself - it only needs to agree on ids.
 * Dispatches plain `Event`s (`selectionChange`, `hoverChange`) rather than
 * `CustomEvent`s, matching `TreeView`'s own `selectionChange` event: state is
 * read back via the `selected`/`hovered` getters, not the event.
 */
export class SelectionManager extends EventTarget {
  #targets = new Map<string, SelectableObject>();
  #meshStyles = new Map<string, MeshSelectionStyle>();
  #color: THREE.ColorRepresentation;
  #hoverColor: THREE.ColorRepresentation;
  #hoverOpacity: number;
  #meshStyle: MeshSelectionStyle;
  #outlineOptions: { linewidth?: number; };
  #highlightOptions: { thickness?: number; };
  #toonOutline: ToonOutlinePass | null;
  #toonOutlineOptions: { edgeThickness?: number; hiddenColor?: THREE.ColorRepresentation; };
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
    this.#meshStyle = options.meshStyle ?? "outline";
    this.#outlineOptions = { ...options.outline };
    this.#highlightOptions = { ...options.highlight };
    this.#toonOutline = options.toonOutline ?? null;
    this.#toonOutlineOptions = { ...options.toonOutlineOptions };
    this.#xray = options.xray ?? false;

    // The manager's own color/hover/xray/toonOutline settings are the
    // source of truth `ToonOutlinePass` mirrors (see this class's own doc
    // comment) - push them in immediately so it starts in sync rather than
    // sitting on whatever defaults it was constructed with.
    if (this.#toonOutline) {
      this.#toonOutline.setColor(this.#color);
      this.#toonOutline.setHoverColor(this.#hoverColor);
      this.#toonOutline.setHoverOpacity(this.#hoverOpacity);
      this.#toonOutline.setXray(this.#xray);
      this.#applyToonOutlineOptions();
    }
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
   * unaffected. Also pushed to `toonOutline` (if set), regardless of whether
   * it's the currently active style - see this class's own doc comment.
   */
  setColor(
    color: THREE.ColorRepresentation
  ): void {
    this.#color = color;
    this.#selectedOverlay?.setColor(color);
    this.#toonOutline?.setColor(color);
  }

  /**
   * Updates the color of the dimmer "hover" overlay and immediately
   * refreshes the active hover overlay (if any and not currently suppressed
   * by a matching selection) so the change is visible without re-hovering.
   * Also pushed to `toonOutline` (if set) - see `setColor`.
   */
  setHoverColor(
    color: THREE.ColorRepresentation
  ): void {
    this.#hoverColor = color;
    this.#hoverOverlay?.setColor(color);
    this.#toonOutline?.setHoverColor(color);
  }

  /**
   * Updates the opacity of the dimmer "hover" overlay and immediately
   * refreshes the active hover overlay (if any and not currently suppressed
   * by a matching selection) so the change is visible without re-hovering.
   * Also pushed to `toonOutline` (if set) - see `setColor`.
   */
  setHoverOpacity(
    opacity: number
  ): void {
    this.#hoverOpacity = opacity;
    this.#hoverOverlay?.setOpacity(opacity);
    this.#toonOutline?.setHoverOpacity(opacity);
  }

  register(
    id: string,
    target: SelectableObject,
    options: { style?: MeshSelectionStyle; } = {}
  ): void {
    this.#targets.set(id, target);

    if (options.style) {
      this.#meshStyles.set(id, options.style);
    }
    else {
      this.#meshStyles.delete(id);
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
    this.#meshStyles.delete(id);
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
   * Default overlay style for registered meshes - see `meshStyle` on
   * `SelectionManagerOptions`. A group's `SelectionBoundingBox` never
   * depends on this.
   */
  get meshStyle(): MeshSelectionStyle {
    return this.#meshStyle;
  }

  /**
   * Switches the manager's mesh overlay style for every mesh - including
   * ids registered with their own per-id `style` override via `register`,
   * which this drops - and immediately rebuilds the active selection/hover
   * overlays so the change is visible without needing to reselect anything.
   * A per-id override can be reinstated afterward with a fresh `register`
   * call, until the next `setMeshStyle`.
   */
  setMeshStyle(
    style: MeshSelectionStyle
  ): void {
    const changed = style !== this.#meshStyle || this.#meshStyles.size > 0;
    this.#meshStyle = style;
    this.#meshStyles.clear();

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
   * Current default `SelectionHighlight` tuning - see `highlight` on
   * `SelectionManagerOptions`.
   */
  get highlightOptions(): { thickness?: number; } {
    return { ...this.#highlightOptions };
  }

  /**
   * Merges `options` into the manager's default `SelectionOutline` tuning
   * (e.g. from a settings panel) and immediately rebuilds the active
   * selection/hover overlays so the change is visible without reselecting -
   * same rebuild behavior as `setMeshStyle`. Only affects an overlay
   * currently rendered with the `"outline"` style.
   */
  setOutlineOptions(
    options: { linewidth?: number; }
  ): void {
    this.#outlineOptions = { ...this.#outlineOptions, ...options };
    this.#rebuildActiveOverlays();
  }

  /**
   * Same as `setOutlineOptions`, for the manager's default `SelectionHighlight`
   * tuning. Only affects an overlay currently rendered with the `"highlight"`
   * style.
   */
  setHighlightOptions(
    options: { thickness?: number; }
  ): void {
    this.#highlightOptions = { ...this.#highlightOptions, ...options };
    this.#rebuildActiveOverlays();
  }

  /**
   * Current default `ToonOutlinePass` tuning - see `toonOutlineOptions` on
   * `SelectionManagerOptions`.
   */
  get toonOutlineOptions(): { edgeThickness?: number; hiddenColor?: THREE.ColorRepresentation; } {
    return { ...this.#toonOutlineOptions };
  }

  /**
   * Merges `options` into the manager's default `ToonOutlinePass` tuning and
   * immediately applies it to `toonOutline` (a no-op if none was set) -
   * unlike `setOutlineOptions`/`setHighlightOptions`, this never needs to
   * rebuild an overlay, since `ToonOutlinePass`'s own tuning is all live
   * uniforms rather than baked-in geometry.
   */
  setToonOutlineOptions(
    options: { edgeThickness?: number; hiddenColor?: THREE.ColorRepresentation; }
  ): void {
    this.#toonOutlineOptions = { ...this.#toonOutlineOptions, ...options };
    this.#applyToonOutlineOptions();
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
   * material flags/render order rather than rebuilding geometry. Also
   * pushed to `toonOutline` (if set) - see `setColor`.
   */
  setXray(
    xray: boolean
  ): void {
    this.#xray = xray;
    this.#selectedOverlay?.setXray(xray);
    if (this.#hoveredId !== null && this.#hoveredId !== this.#selectedId) {
      this.#hoverOverlay?.setXray(xray);
    }
    this.#toonOutline?.setXray(xray);
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
    this.#meshStyles.clear();
  }

  /**
   * Resolves the overlay style `id` would render with: its own per-id
   * override if `register` was given one, otherwise the manager's
   * `meshStyle` default. Exposed so `PeerSelectionOverlays` can build
   * matching overlays for remote peer selections via
   * `createSelectionOverlay` without duplicating this resolution.
   */
  styleFor(
    id: string
  ): MeshSelectionStyle {
    return this.#meshStyles.get(id) ?? this.#meshStyle;
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
   * tuning change (`setMeshStyle`, `setOutlineOptions`,
   * `setHighlightOptions`) is visible immediately without needing to
   * reselect anything. `setToonOutlineOptions`/`setColor`/etc. don't need
   * this - `ToonOutlinePass` only ever gets pushed live tuning, never
   * rebuilt.
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
   * overlay, a `toonOutline` target, or nothing) and, if `id` isn't `null`,
   * re-applies it per `id`'s resolved style - a `"toonOutline"` style pushes
   * `id`'s target straight into `toonOutline` instead of building a
   * disposable overlay, since `ToonOutlinePass` isn't a per-id instance (see
   * this class's own doc comment). Only for a `THREE.Mesh` target though - a
   * non-mesh one (typically a `THREE.Group`) always gets a
   * `SelectionBoundingBox` instead, the same fallback `"outline"`/
   * `"highlight"` already get, so a group's selection indicator stays the
   * same line-segment box regardless of style.
   */
  #applySelectedOverlay(
    id: string | null
  ): void {
    this.#selectedOverlay?.dispose();
    this.#selectedOverlay = null;
    this.#toonOutline?.setSelected(null);

    if (id === null) {
      return;
    }

    const target = this.#requireTarget(id);
    if (this.styleFor(id) === "toonOutline" && target instanceof THREE.Mesh) {
      this.#requireToonOutline().setSelected(target);

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
    this.#toonOutline?.setHovered(null);

    if (id === null) {
      return;
    }

    const target = this.#requireTarget(id);
    if (this.styleFor(id) === "toonOutline" && target instanceof THREE.Mesh) {
      this.#requireToonOutline().setHovered(target);

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
    const style = this.styleFor(id);

    // A `"toonOutline"` style only reaches here for a non-mesh target (see
    // `#applySelectedOverlay`/`#applyHoverOverlay`) - `createSelectionOverlay`
    // falls back to `SelectionBoundingBox` for those regardless of `style`,
    // same as `"outline"`/`"highlight"`.
    return createSelectionOverlay(target, {
      style,
      color,
      opacity,
      linewidth: this.#outlineOptions.linewidth,
      thickness: this.#highlightOptions.thickness,
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

  /**
   * `toonOutline`, or throws a clear error if `styleFor` resolved to
   * `"toonOutline"` without one having been passed to the constructor - a
   * silent no-op there would leave a selection with no visible feedback at
   * all, which is worse than failing loudly at the point of misconfiguration.
   */
  #requireToonOutline(): ToonOutlinePass {
    if (!this.#toonOutline) {
      throw new Error(
        "SelectionManager: resolved to the \"toonOutline\" style but no ToonOutlinePass was " +
        "given - pass one via the \"toonOutline\" constructor option."
      );
    }

    return this.#toonOutline;
  }

  #applyToonOutlineOptions(): void {
    if (!this.#toonOutline) {
      return;
    }

    const { edgeThickness, hiddenColor } = this.#toonOutlineOptions;
    if (edgeThickness !== undefined) {
      this.#toonOutline.setEdgeThickness(edgeThickness);
    }
    if (hiddenColor !== undefined) {
      this.#toonOutline.setHiddenColor(hiddenColor);
    }
  }
}
