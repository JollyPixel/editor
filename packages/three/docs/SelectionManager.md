# SelectionManager

Tracks a single selected id and a single hovered id across a pool of
registered objects, extending `EventTarget`. Renders a
[SelectionOutline](./SelectionOutline.md) or a
[SelectionHighlight](./SelectionHighlight.md) for a `THREE.Mesh` (`"outline"`
by default, see `meshStyle` below), a
[SelectionBoundingBox](./SelectionBoundingBox.md) for anything else
(typically a `THREE.Group`), or drives a shared
[ToonOutlinePass](./ToonOutlinePass.md) - callers never need to know which
technique a given id resolves to.

The first two styles are per-object overlay children this class builds and
disposes itself as selection/hover changes; `"toonOutline"` is a
scene-level pipeline instead, supplied (not owned) via the `toonOutline`
constructor option - this class only ever pushes selected/hovered targets and
shared tuning into it, never constructs or disposes it.

Objects are addressed by a caller-assigned string id rather than by object
reference, so that a UI outside the 3D view (e.g. a `TreeView` from
`@jolly-pixel/fs-tree`) can drive selection without holding onto
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

// A smooth/high-poly mesh reads poorly as a SelectionOutline (see that
// class's own Notes) - opt it into the SelectionHighlight overlay instead.
selection.register("torus-knot", torusKnotMesh, { style: "highlight" });
```

```ts
// Wiring up ToonOutlinePass as a technique - see that class's own doc for
// building the pipeline itself.
import { SelectionManager, ToonOutlinePass } from "@jolly-pixel/three";

const toonOutline = new ToonOutlinePass(renderer, scene, camera);
const selection = new SelectionManager({ toonOutline, meshStyle: "toonOutline" });
selection.register("mesh-1", mesh);
selection.register("group-1", group); // still a SelectionBoundingBox - groups always are, regardless of style

selection.select("mesh-1"); // pushes `mesh` into toonOutline.setSelected, no overlay child added

renderer.setAnimationLoop(() => {
  toonOutline.render(); // replaces renderer.render(scene, camera) - safe even if nothing uses this style yet
});
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
  outline?: { linewidth?: number };
  /**
   * Default `SelectionHighlight` tuning applied to every mesh rendered with
   * the `"highlight"` style. Fields left unset here fall back to
   * `SelectionHighlightOptions`'s own defaults. Adjustable at runtime via
   * `setHighlightOptions`.
   */
  highlight?: { thickness?: number };
  /**
   * The pipeline driving the `"toonOutline"` style, if any - not owned by
   * `SelectionManager` (never disposed by it), only pushed to. Required for
   * any registered id to actually resolve to `"toonOutline"` (via
   * `meshStyle` or a per-id `register` override); resolving without one set
   * throws. `color`/`hoverColor`/`hoverOpacity`/`xray` below apply to it the
   * same as to the per-object overlay styles, kept in sync automatically.
   */
  toonOutline?: ToonOutlinePass;
  /**
   * Default `ToonOutlinePass` tuning applied whenever `toonOutline` above is
   * set. Fields left unset here fall back to `ToonOutlinePassOptions`'s own
   * defaults. Adjustable at runtime via `setToonOutlineOptions`.
   */
  toonOutlineOptions?: { edgeThickness?: number; hiddenColor?: THREE.ColorRepresentation };
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
```

## MeshSelectionStyle

```ts
export type MeshSelectionStyle = "outline" | "highlight" | "toonOutline";
```

Which technique a registered object renders when selected/hovered. A
non-mesh target (e.g. a `THREE.Group`) always renders `SelectionBoundingBox`
regardless of this setting - a group's selection indicator stays the same
line-segment box no matter which style is active.

- `"outline"` - [SelectionOutline](./SelectionOutline.md), a clean silhouette on low-poly/hard-surface meshes, but busy on smooth/high-poly ones.
- `"highlight"` - [SelectionHighlight](./SelectionHighlight.md), an inverted-hull rim that reads cleanly on any mesh regardless of complexity. Requires `THREE.WebGPURenderer` (see that class's own Notes).
- `"toonOutline"` - [ToonOutlinePass](./ToonOutlinePass.md), a scene-level postprocess outline instead of a per-object overlay child. Requires a `ToonOutlinePass` passed via the `toonOutline` constructor option - resolving to this style for a mesh without one set throws.

## Properties

- `selected: string | null` - Currently selected id, or `null`.
- `hovered: string | null` - Currently hovered id, or `null`.
- `color: THREE.ColorRepresentation` - Current color of the full-opacity "selected" overlay (see `setColor`).
- `hoverColor: THREE.ColorRepresentation` - Current color of the dimmer "hover" overlay (see `setHoverColor`).
- `hoverOpacity: number` - Current opacity of the dimmer "hover" overlay (see `setHoverOpacity`).
- `meshStyle: MeshSelectionStyle` - Current default mesh overlay style (see `setMeshStyle`).
- `outlineOptions: { linewidth?: number }` - Current default `SelectionOutline` tuning (see `setOutlineOptions`).
- `highlightOptions: { thickness?: number }` - Current default `SelectionHighlight` tuning (see `setHighlightOptions`).
- `toonOutlineOptions: { edgeThickness?: number; hiddenColor?: THREE.ColorRepresentation }` - Current default `ToonOutlinePass` tuning (see `setToonOutlineOptions`).
- `xray: boolean` - Current X-ray state, applied regardless of style (see `setXray`).

## Methods

- `register(id: string, target: THREE.Mesh | THREE.Object3D, options?: { style?: MeshSelectionStyle }): void` - Associates an id with an object. Re-registering an existing id replaces its target. `options.style` overrides `meshStyle` for this id only; omitting it falls back to `meshStyle`.
- `unregister(id: string): void` - Drops `id` from the registry, clearing its selection/hover overlay (or `toonOutline` target) first if it holds either.
- `select(id: string | null): void` - Selects `id`. Throws if `id` was not registered, or if it resolves to `"toonOutline"` without one configured. No-ops (and does not dispatch) if `id` already is the selection.
- `hover(id: string | null): void` - Same as `select`, but for the dimmer hover overlay. Suppressed when `id` is already the current selection, and dropped automatically once that id becomes the selection.
- `setColor(color: THREE.ColorRepresentation): void` - Updates the "selected" overlay color and recolors the active selection overlay in place (no rebuild - cheap, like the overlay classes' own `setColor`). The hover overlay is unaffected. Also pushed to `toonOutline` (if set), regardless of whether it's the currently active style.
- `setHoverColor(color: THREE.ColorRepresentation): void` - Same as `setColor`, for the dimmer "hover" overlay.
- `setHoverOpacity(opacity: number): void` - Updates the active hover overlay's opacity in place. Also pushed to `toonOutline`.
- `setMeshStyle(style: MeshSelectionStyle): void` - Switches the technique at runtime for every id (e.g. from a settings panel), including ids registered with their own per-id `style` override - `register`'s `style` is dropped for all ids, so a per-id override only sticks until the next `setMeshStyle` call, reinstated afterward with a fresh `register`. Immediately rebuilds the active selection/hover overlays (or pushes into `toonOutline`) so the change is visible without reselecting. No-ops if `style` already is the default and no per-id override was set.
- `setOutlineOptions(options: { linewidth?: number }): void` - Merges `options` into the manager's default `SelectionOutline` tuning and immediately rebuilds the active selection/hover overlays. Only affects an overlay currently rendered with the `"outline"` style.
- `setHighlightOptions(options: { thickness?: number }): void` - Same as `setOutlineOptions`, for `SelectionHighlight` tuning. Only affects an overlay currently rendered with the `"highlight"` style.
- `setToonOutlineOptions(options: { edgeThickness?: number; hiddenColor?: THREE.ColorRepresentation }): void` - Merges `options` into the manager's default `ToonOutlinePass` tuning and immediately applies it to `toonOutline` (a no-op if none was set). Unlike `setOutlineOptions`/`setHighlightOptions`, never rebuilds an overlay - `ToonOutlinePass`'s tuning is all live uniforms.
- `setXray(xray: boolean): void` - Toggles X-ray on the active selection/hover overlays in place (no rebuild - cheap, like `setColor`). Applies regardless of style, including `toonOutline`.
- `styleFor(id: string): MeshSelectionStyle` - Resolves the style `id` would render with: its per-id override if `register` was given one, otherwise `meshStyle`. Exposed for [PeerSelectionOverlays](./PeerSelectionOverlays.md) to build matching overlays for remote peer selections.
- `targetFor(id: string): THREE.Mesh | THREE.Object3D | undefined` - The object registered for `id`, or `undefined` if none is.
- `dispose(): void` - Clears selection, hover (including any `toonOutline` target), and forgets every registered id. The instance can be reused afterward via `register`. Does not dispose `toonOutline` itself - it isn't owned by this class.

## Events

- `selectionChange` - Dispatched (as a plain `Event`, no `detail`) whenever `select()` actually changes the selection. Read the new value via the `selected` getter, mirroring `TreeView`'s own `selectionChange` event.
- `hoverChange` - Same, for `hover()`.

## Notes

- `select`/`hover` check `target instanceof THREE.Mesh` first: anything else (a `THREE.Group`, or any other non-mesh `Object3D`) always gets `SelectionBoundingBox`, regardless of `styleFor(id)`. For a mesh, `styleFor(id)` decides between `SelectionOutline`/`SelectionHighlight` and pushing the target straight into `toonOutline` (throwing if `"toonOutline"` resolved without one configured).
- A peer selection (see [PeerSelectionOverlays](./PeerSelectionOverlays.md) below) always falls back to `"outline"` when `styleFor` resolves to `"toonOutline"` - `ToonOutlinePass` is one shared pipeline, not a per-id instance, so it can't represent more than one simultaneously colored peer selection.
- Does not do any picking/raycasting itself - it only reacts to ids handed to it. See `examples/scripts/demo-selection.ts` for a `resolvePickId` helper that maps a raycast hit straight to the specific mesh's id, so 3D-view picks never need extra clicks to drill past a parent group - selecting a group as a whole is only done from the outliner (e.g. `TreeView`).
- Only models a single local user. For remote peers, see [PeerSelectionRegistry](./PeerSelectionRegistry.md) (tracks which peers have what selected) and [PeerSelectionOverlays](./PeerSelectionOverlays.md) (renders one overlay per object in the primary peer's color, reusing `styleFor`/`targetFor` above).
