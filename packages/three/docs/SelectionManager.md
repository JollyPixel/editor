# SelectionManager

Tracks a single selected id and a single hovered id across a pool of
registered objects, extending `EventTarget`. Renders a
[SelectionOutline](./SelectionOutline.md) for a `THREE.Mesh` or a
[SelectionBoundingBox](./SelectionBoundingBox.md) for anything else
(typically a `THREE.Group`) - callers never need to know which overlay a
given id resolves to.

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
}
```

## Properties

- `selected: string | null` - Currently selected id, or `null`.
- `hovered: string | null` - Currently hovered id, or `null`.

## Methods

- `register(id: string, target: THREE.Mesh | THREE.Object3D): void` - Associates an id with an object. Re-registering an existing id replaces its target.
- `unregister(id: string): void` - Drops `id` from the registry, clearing its selection/hover overlay first if it holds either.
- `select(id: string | null): void` - Selects `id`, disposing the previous selection overlay. Throws if `id` was not registered. No-ops (and does not dispatch) if `id` already is the selection.
- `hover(id: string | null): void` - Same as `select`, but for the dimmer hover overlay. Suppressed when `id` is already the current selection, and dropped automatically once that id becomes the selection.
- `dispose(): void` - Clears selection, hover, and forgets every registered id. The instance can be reused afterward via `register`.

## Events

- `selectionChange` - Dispatched (as a plain `Event`, no `detail`) whenever `select()` actually changes the selection. Read the new value via the `selected` getter, mirroring `TreeView`'s own `selectionChange` event.
- `hoverChange` - Same, for `hover()`.

## Notes

- `select`/`hover` decide the overlay type from `target instanceof THREE.Mesh`: a mesh gets a `SelectionOutline`, anything else (a `THREE.Group`, or any other `Object3D`) gets a `SelectionBoundingBox`.
- Does not do any picking/raycasting itself - it only reacts to ids handed to it. See `examples/scripts/demo-selection.ts` for a `resolvePickId` helper that maps a raycast hit to a group id first, then to the specific mesh id on a repeated pick of an already-selected group (solo group selection vs. drilling into one of its parts).
