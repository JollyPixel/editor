# SelectionBoundingBox

Non-destructive bounding-box overlay for a group of meshes, extending
`THREE.LineSegments`. Built from the local-space union of every mesh
descendant's own bounding box and added as a child of `target` - it inherits
the group's rotation for free, unlike a world-space axis-aligned box which
would look loose once the group is rotated.

```ts
import { SelectionBoundingBox } from "@jolly-pixel/three";

const box = new SelectionBoundingBox({ target: group, color: "#ffffff" });
// ... later, after children are added/removed
box.update();
// ... later
box.dispose();
```

## SelectionBoundingBoxOptions

```ts
export interface SelectionBoundingBoxOptions {
  /**
   * Group being outlined. The box is added as a child of `target`, so it
   * inherits its transform for free and is automatically removed if `target`
   * itself is later removed from the scene.
   */
  target: THREE.Object3D;
  /**
   * @default "#ffffff"
   */
  color?: THREE.ColorRepresentation;
  /**
   * Material opacity. Lets a dimmer "hover" box and a full "selected" box
   * share the same class without a second visual language.
   * @default 1
   */
  opacity?: number;
}
```

## Methods

- `update(): void` - Recomputes the box from `target`'s current mesh descendants. Call this after adding/removing children or after a descendant's own geometry changes.
- `setColor(color: THREE.ColorRepresentation): void` - Updates the box material's color.
- `setOpacity(opacity: number): void` - Updates the box material's opacity, toggling `transparent` accordingly.
- `dispose(): void` - Removes itself from `target`'s children and disposes the geometry and material.

## Notes

- The box is hidden (`visible = false`) when `target` has no mesh descendants.
- Scaled up by a fixed 1% (`kSizeBias`) around its own center to avoid z-fighting when the group contains a single mesh whose own bounding box would otherwise coincide exactly with the box overlay.
- Does not track live geometry/hierarchy changes automatically - call `update()` after mutating `target`'s children, same limitation as [SelectionOutline](./SelectionOutline.md) not tracking geometry swaps.
- See `examples/scripts/demo-selection.ts` (run `npm run dev`, open `/selection.html`) - the "Cluster" group there uses this class, with a first click selecting the whole group and a second click drilling into the specific mesh under the cursor via [SelectionManager](./SelectionManager.md).
