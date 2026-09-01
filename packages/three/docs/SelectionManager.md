# SelectionManager

Tracks a single selected id and a single hovered id across a pool of
registered objects, extending `EventTarget`. Renders a
[SelectionOutline](./SelectionOutline.md) for a `THREE.Mesh` (the only
built-in per-object technique, see `technique` below), or a
[SelectionBoundingBox](./SelectionBoundingBox.md) for anything else
(typically a `THREE.Group`) - callers never need to know which technique a
given id resolves to.

`"outline"` (and every non-mesh id, regardless of technique) is a per-object
overlay child this class builds and disposes itself as selection/hover
changes; `"highlight"`/`"highlightJfa"` are scene-level pipelines instead,
entirely outside this class - see `SelectionTechnique` below for what
driving one actually requires.

Objects are addressed by a caller-assigned string id rather than by object
reference, so that a UI outside the 3D view (e.g. a `TreeView` from
`@jolly-pixel/arbor`) can drive selection without holding onto
`THREE.Object3D` instances itself - it only needs to agree on ids with
whatever registered them.

```ts
import { SelectionManager } from "@jolly-pixel/three";

const selection = new SelectionManager({ color: "#ffffff" });
selection.register("mesh-1", mesh);
selection.register("group-1", group);

selection.addEventListener("selectionChange", () => {
  console.log("selected:", selection.selected);
});

selection.select("group-1"); // draws a SelectionBoundingBox on `group`
selection.select("mesh-1");  // disposes it, draws a SelectionOutline on `mesh`
selection.select(null);      // clears the selection
```

```ts
// "highlight"/"highlightJfa" both skip the per-object overlay entirely - a
// separate PeerHighlightPass (even with zero peers registered) or
// equivalent reads `selected`/`hovered`/`color`/`hoverColor` and renders
// through a HighlightPass or HighlightPassJfa instead. See
// HighlightPass/HighlightPassJfa/PeerHighlightPass's own docs for building
// that pipeline.
import { SelectionManager } from "@jolly-pixel/three";

const selection = new SelectionManager({ technique: "highlight" }); // or "highlightJfa"
selection.register("mesh-1", mesh);
selection.register("group-1", group); // still a SelectionBoundingBox - groups always are, regardless of technique

selection.select("mesh-1"); // no overlay child added - selection.selected/.color are what a driving pass reads
```

## SelectionManagerOptions

```ts
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
  outline?: { linewidth?: number };
  /**
   * Default `SelectionBoundingBox` tuning applied to every group (any
   * registered non-mesh target - `SelectionBoundingBox` is what such a
   * target always renders, regardless of `technique`). Fields left unset
   * here fall back to `SelectionBoundingBoxOptions`'s own defaults.
   * Adjustable at runtime via `setBoundingBoxOptions`.
   */
  boundingBox?: { fillOpacity?: number };
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
```

## SelectionTechnique

```ts
export type SelectionTechnique = "outline" | "highlight" | "highlightJfa" | (string & {});
```

Which technique a registered object renders when selected/hovered. A
non-mesh target (e.g. a `THREE.Group`) always renders `SelectionBoundingBox`
regardless of this setting - a group's selection indicator stays the same
line-segment box no matter which technique is active. Under `"highlight"`/
`"highlightJfa"` this box renders *alongside*, not instead of, the
scene-level per-mesh colored highlight a [PeerHighlightPass](./PeerHighlightPass.md)
(or equivalent) still draws for that same group - deliberately both at once,
see that class's own doc comment for why.

- `"outline"` - [SelectionOutline](./SelectionOutline.md), a clean silhouette via `THREE.EdgesGeometry`, cheap and pipeline-free (composes with any host render pipeline, unlike `"highlight"`/`"highlightJfa"` below).
- `"highlight"` - [HighlightPass](./HighlightPass.md), a scene-level postprocess outline (a blurred edge map) instead of a per-object overlay child.
- `"highlightJfa"` - [HighlightPassJfa](./HighlightPassJfa.md), the same scene-level postprocess concept as `"highlight"`, but a Jump Flood Algorithm distance field instead of a blurred edge map - a real per-pixel distance to the silhouette, so the ring reads the same width regardless of viewing angle or downsample level.

For either scene-level technique, `SelectionManager` itself never owns or drives the actual pass - resolving an id to one just skips building a local overlay for it. Actually rendering anything requires a separate [PeerHighlightPass](./PeerHighlightPass.md) (even with zero peers registered) or equivalent reading this manager's `selected`/`hovered`/`color`/`hoverColor` and driving a `HighlightPass`/`HighlightPassJfa` itself. **Misconfiguring this - choosing one of these with nothing actually wired up - fails silently** (no visible feedback, no thrown error), unlike every other technique here: this manager holds no reference to any pipeline object to loudly check against.

These three are only the built-in ids, kept as literals for editor
autocomplete - not exhaustive. `"outline"` resolves through
`defaultSelectionOverlayRegistry`, a `SelectionOverlayRegistry` exported from
`@jolly-pixel/three` alongside `createSelectionOverlay`. A caller that wants
a different or additional per-object technique - e.g. another editor in this
monorepo with its own visual style - implements a `SelectionOverlayFactory`
and either `.register()`s it into `defaultSelectionOverlayRegistry` or builds
a separate `SelectionOverlayRegistry` and resolves against that directly;
any registered id is then a legal `SelectionTechnique` value, which is why
the type keeps a trailing `(string & {})` branch instead of being a closed
union.

```ts
import { defaultSelectionOverlayRegistry, type SelectionOverlayFactory } from "@jolly-pixel/three";

const myTechnique: SelectionOverlayFactory = {
  id: "my-technique",
  supports: (target) => target instanceof THREE.Mesh,
  create: (target, options) => new MyOverlay({ target, ...options })
};
defaultSelectionOverlayRegistry.register(myTechnique);

selection.register("mesh-1", mesh, { technique: "my-technique" });
```

## Properties

- `selected: string | null` - Currently selected id, or `null`.
- `hovered: string | null` - Currently hovered id, or `null`.
- `color: THREE.ColorRepresentation` - Current color of the full-opacity "selected" overlay (see `setColor`).
- `hoverColor: THREE.ColorRepresentation` - Current color of the dimmer "hover" overlay (see `setHoverColor`).
- `hoverOpacity: number` - Current opacity of the dimmer "hover" overlay (see `setHoverOpacity`).
- `technique: SelectionTechnique` - Current default mesh overlay technique (see `setTechnique`).
- `outlineOptions: { linewidth?: number }` - Current default `SelectionOutline` tuning (see `setOutlineOptions`).
- `boundingBoxOptions: { fillOpacity?: number }` - Current default `SelectionBoundingBox` tuning (see `setBoundingBoxOptions`).
- `xray: boolean` - Current X-ray state, applied regardless of technique (see `setXray`).

## Methods

- `register(id: string, target: THREE.Mesh | THREE.Object3D, options?: { technique?: SelectionTechnique }): void` - Associates an id with an object. Re-registering an existing id replaces its target. `options.technique` overrides the manager's default `technique` for this id only; omitting it falls back to `technique`.
- `unregister(id: string): void` - Drops `id` from the registry, clearing its selection/hover overlay first if it holds either.
- `select(id: string | null): void` - Selects `id`. Throws if `id` was not registered. No-ops (and does not dispatch) if `id` already is the selection.
- `hover(id: string | null): void` - Same as `select`, but for the dimmer hover overlay. Suppressed when `id` is already the current selection, and dropped automatically once that id becomes the selection.
- `setColor(color: THREE.ColorRepresentation): void` - Updates the "selected" overlay color and recolors the active selection overlay in place (no rebuild - cheap, like the overlay classes' own `setColor`). The hover overlay is unaffected.
- `setHoverColor(color: THREE.ColorRepresentation): void` - Same as `setColor`, for the dimmer "hover" overlay.
- `setHoverOpacity(opacity: number): void` - Updates the active hover overlay's opacity in place.
- `setTechnique(technique: SelectionTechnique): void` - Switches the technique at runtime for every id (e.g. from a settings panel), including ids registered with their own per-id `technique` override - `register`'s `technique` is dropped for all ids, so a per-id override only sticks until the next `setTechnique` call, reinstated afterward with a fresh `register`. Immediately rebuilds the active selection/hover overlays so the change is visible without reselecting. No-ops if `technique` already is the default and no per-id override was set.
- `setOutlineOptions(options: { linewidth?: number }): void` - Merges `options` into the manager's default `SelectionOutline` tuning and immediately rebuilds the active selection/hover overlays. Only affects an overlay currently rendered with the `"outline"` technique.
- `setBoundingBoxOptions(options: { fillOpacity?: number }): void` - Merges `options` into the manager's default `SelectionBoundingBox` tuning and immediately rebuilds the active selection/hover overlays. Only affects a currently rendered group overlay.
- `setXray(xray: boolean): void` - Toggles X-ray on the active selection/hover overlays in place (no rebuild - cheap, like `setColor`). Applies regardless of technique.
- `techniqueFor(id: string): SelectionTechnique` - Resolves the technique `id` would render with: its per-id override if `register` was given one, otherwise the manager's default `technique`. Exposed for [PeerSelectionOverlays](./PeerSelectionOverlays.md) to build matching overlays for remote peer selections.
- `targetFor(id: string): THREE.Mesh | THREE.Object3D | undefined` - The object registered for `id`, or `undefined` if none is.
- `dispose(): void` - Clears selection and hover, and forgets every registered id. The instance can be reused afterward via `register`.

## isScenePipelineTechnique

```ts
export function isScenePipelineTechnique(technique: SelectionTechnique): boolean;
```

Module-level export (not a method) - `true` for `"highlight"`/`"highlightJfa"`, `false` otherwise. This class and [PeerSelectionOverlays](./PeerSelectionOverlays.md) both use it to recognize either scene-level pipeline technique without duplicating a two-way string comparison at every call site.

## Events

- `selectionChange` - Dispatched (as a plain `Event`, no `detail`) whenever `select()` actually changes the selection. Read the new value via the `selected` getter, mirroring `TreeView`'s own `selectionChange` event.
- `hoverChange` - Same, for `hover()`.

## Notes

- `select`/`hover` check `target instanceof THREE.Mesh` first: anything else (a `THREE.Group`, or any other non-mesh `Object3D`) always gets `SelectionBoundingBox`, regardless of `techniqueFor(id)`. For a mesh, `techniqueFor(id)` decides between `SelectionOutline`/a registered custom technique and skipping the overlay entirely for `"highlight"`/`"highlightJfa"` (see the exported `isScenePipelineTechnique(technique)` helper, which both this class and `PeerSelectionOverlays` use to recognize either one).
- A peer selection (see [PeerSelectionOverlays](./PeerSelectionOverlays.md) below) always falls back to `"outline"` when `techniqueFor` resolves to a scene-level pipeline technique - `HighlightPass`/`HighlightPassJfa` are each one shared pipeline, not a per-id instance, so neither can represent more than one simultaneously colored peer selection.
- Does not do any picking/raycasting itself - it only reacts to ids handed to it. See `examples/scripts/selection.ts` for a `resolvePickId` helper that maps a raycast hit straight to the specific mesh's id, so 3D-view picks never need extra clicks to drill past a parent group - selecting a group as a whole is only done from the outliner (e.g. `TreeView`).
- Only models a single local user. For remote peers, see [PeerSelectionRegistry](./PeerSelectionRegistry.md) (tracks which peers have what selected) and [PeerSelectionOverlays](./PeerSelectionOverlays.md) (renders one overlay per object in the primary peer's color, reusing `techniqueFor`/`targetFor` above).
- See [SelectionOverlayRegistry](./SelectionOverlayRegistry.md) for how `"outline"` (and any custom per-object technique) actually resolves to a concrete overlay class, and how to register a new one.
