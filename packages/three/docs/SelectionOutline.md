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
  /**
   * Line thickness in (CSS) pixels, forwarded straight to
   * `THREE.LineBasicMaterial.linewidth`. Most WebGL backends silently clamp
   * this to 1 regardless of the value given - a long-standing ANGLE/GL_LINES
   * driver limitation `LineBasicMaterial` does nothing to work around - so a
   * value above 1 is a "nice if the platform honors it" upgrade, not a
   * guarantee; `WebGPURenderer` is not affected.
   * @default 1
   */
  linewidth?: number;
  /**
   * Skips the depth test (and depth write) so the outline stays visible
   * through any geometry in front of it, like an X-ray, instead of being
   * occluded like a normal object - handy for keeping a selection visible
   * through walls or a crowded scene. Still a single draw call either way,
   * so this doesn't cost anything extra to render.
   * @default false
   */
  xray?: boolean;
}
```

## Methods

- `setColor(color: THREE.ColorRepresentation): void` - Updates the outline material's color.
- `setOpacity(opacity: number): void` - Updates the outline material's opacity, toggling `transparent` accordingly.
- `setLinewidth(linewidth: number): void` - Updates the outline material's `linewidth` - subject to the same platform caveat as the constructor option.
- `setXray(xray: boolean): void` - Toggles depth-test/write and render order between the normal and X-ray behavior described on `xray` above.
- `dispose(): void` - Removes itself from `target`'s children and disposes the geometry and material.

## Notes

- Built from `THREE.EdgesGeometry`, which filters out edges below a threshold angle - very smooth/high-poly meshes (e.g. UV spheres) can still read as a busy wireframe rather than a clean silhouette. Low-poly and hard-surface geometry (boxes, cones, icosahedrons) outline cleanly. For a smooth/high-poly mesh, [HighlightPass](./HighlightPass.md)'s screen-space silhouette (the `"highlight"` technique) reads cleanly regardless of poly count - see `SelectionManager`'s own `SelectionTechnique` doc for the trade-off (a scene-level pipeline, not a per-object overlay like this class).
- Scaled up by a fixed 0.5% (`kScaleBias`) around the target's own origin to avoid z-fighting with the target's coincident surface - the edges would otherwise sit at the exact same depth as the mesh's own triangles and flicker/dash along the seam. Imperceptible as a size change at typical scene scales.
- `linewidth` above 1 is a best-effort request, not a guarantee - see this option's own doc comment above for the platform caveat. For a line that reliably renders thick everywhere, use a screen-space line library (e.g. `three`'s own `Line2`/`LineMaterial` addons) instead; this class deliberately stays on plain `LineBasicMaterial` to match `SelectionBoundingBox` and avoid pulling in `three/addons`.
- Does not track live geometry changes - if `target.geometry` is swapped after construction, dispose the old outline and create a new one.
- See `examples/scripts/selection.ts` (run `npm run dev`, open `/selection.html`) for a click-to-select, hover-to-preview demo built on this class - single-select only, no networking. It reuses the same class for both the full-opacity "selected" outline and a dimmer "hover" preview via the `opacity` option.
