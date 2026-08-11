# SelectionOutline

Non-destructive outline overlay for a single mesh, extending
`THREE.LineSegments`. Built once from `target.geometry` via
`THREE.EdgesGeometry` and added as a child of `target` - it inherits the
target's transform for free and never touches the target's own material.
Several instances can coexist on the same target (e.g. a local selection plus
one outline per peer that also has it selected) without conflicting, unlike
recoloring the mesh's own material in place.

```ts
import { SelectionOutline } from "@jolly-pixel/three";

const outline = new SelectionOutline({ target: mesh, color: "#ffffff" });
// ... later
outline.dispose();
```

## SelectionOutlineOptions

```ts
export interface SelectionOutlineOptions {
  /**
   * Mesh being outlined. The outline is added as a child of `target`, so it
   * inherits its transform for free and is automatically removed if `target`
   * itself is later removed from the scene.
   */
  target: THREE.Mesh;
  /**
   * @default "#ffffff"
   */
  color?: THREE.ColorRepresentation;
  /**
   * Material opacity. Lets a dimmer "hover" outline and a full "selected"
   * outline share the same class without a second visual language.
   * @default 1
   */
  opacity?: number;
}
```

## Methods

- `setColor(color: THREE.ColorRepresentation): void` - Updates the outline material's color.
- `setOpacity(opacity: number): void` - Updates the outline material's opacity, toggling `transparent` accordingly.
- `dispose(): void` - Removes itself from `target`'s children and disposes the geometry and material.

## Notes

- Built from `THREE.EdgesGeometry`, which filters out edges below a threshold angle - very smooth/high-poly meshes (e.g. UV spheres) can still read as a busy wireframe rather than a clean silhouette. Low-poly and hard-surface geometry (boxes, cones, icosahedrons) outline cleanly.
- Scaled up by a fixed 0.5% (`kScaleBias`) around the target's own origin to avoid z-fighting with the target's coincident surface - the edges would otherwise sit at the exact same depth as the mesh's own triangles and flicker/dash along the seam. Imperceptible as a size change at typical scene scales.
- Does not track live geometry changes - if `target.geometry` is swapped after construction, dispose the old outline and create a new one.
- See `examples/scripts/demo-selection.ts` (run `npm run dev`, open `/selection.html`) for a click-to-select, hover-to-preview demo built on this class - single-select only, no networking. It reuses the same class for both the full-opacity "selected" outline and a dimmer "hover" preview via the `opacity` option.
