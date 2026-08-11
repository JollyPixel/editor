# SelectionHighlight

Non-destructive inverted-hull silhouette overlay for a single mesh, extending
`THREE.Mesh`. A duplicate of `target` with every vertex pushed outward along
a normal, rendered back-face-only so only a thin rim pokes out around its
silhouette from any viewing angle, and added as a child of `target` - it
inherits the target's transform for free and never touches the target's own
material.

Unlike [SelectionOutline](./SelectionOutline.md), this doesn't depend on edge
angles, so it reads as a clean rim on smooth/high-poly meshes (a torus knot,
a sculpted import) where `THREE.EdgesGeometry` would draw far too many "hard"
edges and look like a wireframe soup instead.

> [!NOTE]
> Uses TSL and requires `THREE.WebGPURenderer`, unlike `SelectionOutline`/`SelectionBoundingBox` which stay on classic materials - see this class's own Notes for why.

```ts
import { SelectionHighlight } from "@jolly-pixel/three";

const highlight = new SelectionHighlight({ target: mesh, color: "#ffffff" });
// ... later
highlight.dispose();

// Stays visible through occluding geometry instead of being hidden behind it.
const xrayHighlight = new SelectionHighlight({ target: mesh, xray: true });
```

## SelectionHighlightOptions

```ts
export interface SelectionHighlightOptions {
  /**
   * Mesh being highlighted. The hull is added as a child of `target`, so it
   * inherits its transform for free and is automatically removed if `target`
   * itself is later removed from the scene.
   */
  target: THREE.Mesh;
  /**
   * @default "#ffffff"
   */
  color?: THREE.ColorRepresentation;
  /**
   * Material opacity. Lets a dimmer "hover" highlight and a full "selected"
   * highlight share the same class without a second visual language.
   * @default 1
   */
  opacity?: number;
  /**
   * Skips the depth test (and depth write) so the rim stays visible through
   * any geometry in front of it, like an X-ray, instead of being occluded
   * like a normal object - handy for keeping a selection visible through
   * walls or a crowded scene. Also fades the hull's opacity by view angle (a
   * Fresnel term) so only the true grazing-angle rim stays visible - without
   * this, disabling the depth test alone would reveal the *entire* solid
   * hull, not just the thin rim (see this class's own Notes for why). Still
   * a single draw call either way, so this doesn't cost anything extra to
   * render.
   * @default false
   */
  xray?: boolean;
  /**
   * Rim thickness, expressed as a fraction of the target's own
   * bounding-sphere radius rather than a fixed world-space distance - see
   * `kHullBiasRatio`'s own comment for why a ratio instead of a fixed
   * distance. Too small and the rim z-fights/disappears, too large and it
   * reads as a bulky halo instead of a thin line.
   * @default 0.03
   */
  thickness?: number;
}
```

## Methods

- `setColor(color: THREE.ColorRepresentation): void` - Updates the highlight material's color.
- `setOpacity(opacity: number): void` - Updates the highlight material's opacity, toggling `transparent` accordingly.
- `setThickness(thickness: number): void` - Rebuilds the hull geometry at the given thickness, disposing the previous one. Unlike `setColor`/`setOpacity`, thickness is baked into vertex positions rather than read from the material each frame, so this can't be a cheap in-place update.
- `setXray(xray: boolean): void` - Toggles depth-test/write and render order between the normal and X-ray behavior described on `xray` above.
- `dispose(): void` - Removes itself from `target`'s children and disposes its own geometry (the extruded copy built at construction, not `target`'s own) and material.

## Notes

- Builds its own standalone geometry at construction - a fresh position buffer (each vertex of `target.geometry` pushed outward along its own normal) plus a *cloned* copy of `target.geometry`'s index buffer, not the same attribute object. `dispose()` disposes this geometry independently; `target`'s own geometry is never touched, and never at risk from it - sharing the index attribute directly would let a renderer free `target`'s own GPU index buffer the moment a highlight built from it is disposed (which happens on every hover-out), since GPU buffer cleanup is keyed by attribute identity, not by which geometry currently "owns" it.
- Each vertex is pushed outward by `thickness` (3% of the target geometry's bounding-sphere radius by default) - proportional to the mesh's own size rather than a fixed world-space distance, and correct on concave geometry (a torus's inner hole, a torus knot's self-wrapping tube) where a uniform origin-based scale would thin out or invert the rim instead of growing it. Computed once on the CPU into a plain buffer rather than via a vertex shader patch (e.g. `onBeforeCompile`), so it renders identically under `WebGLRenderer` and `WebGPURenderer` - `onBeforeCompile` is a classic-GLSL hook that `WebGPURenderer`'s node-material pipeline silently ignores, which would leave the hull sitting exactly on the target's own surface and entirely depth-occluded by it (invisible). Rendered with `THREE.BackSide` so only the hull's outward-facing back faces show past the target's own silhouette; the target's own front faces occlude the rest.
- The direction each vertex extrudes along is its normal *averaged with every other vertex at that exact position*, not just its own - a hard-edged mesh (a box, a low-poly primitive) duplicates a vertex once per adjacent face, each copy carrying that face's own flat normal, so extruding each copy along its own normal alone would pull a shared edge/corner apart into a visibly "disconnected per face" hull instead of one connected piece. A smooth mesh (no duplicated positions) is unaffected by this either way, since there's nothing to average against.
- Falls back to `geometry.computeVertexNormals()` if `target.geometry` has no `normal` attribute yet.
- `xray: true` disables `depthTest`/`depthWrite` and raises `renderOrder` well above the scene's default, so the rim reliably draws on top of any occluder regardless of render order - useful for a selection that must stay visible through walls or a crowded scene, at the cost of no longer respecting real depth ordering. Without the `xray: false` rim's own occlusion against the target's own front faces, disabling the depth test alone would fill in the entire hull rather than just its rim, since GPU depth testing can't tell "occluded by the target itself" apart from "occluded by something else" - `material.opacityNode` (a TSL fragment shader, see `buildHighlightMaterial`) compensates by fading each fragment's opacity by view angle (a Fresnel term: near-1 at a grazing angle close to the silhouette, near-0 face-on toward the camera), discarding near-zero fragments outright to skip blending. `material.color`/`.opacity`/`.transparent`/`.depthTest`/`.depthWrite` stay plain classic `Material` properties throughout - only this extra fade needs a node, so `setColor`/`setOpacity` never touch the node graph, and every `SelectionHighlight` instance still shares one compiled shader pipeline (parameterized via a `uniform`, not baked per instance) regardless of how many are on screen at once - relevant for a collaborative editor rendering one overlay per peer selection.
- Does not track live geometry changes - if `target.geometry` is swapped after construction, dispose the old highlight and create a new one.
- See `examples/scripts/demo-selection.ts` (run `npm run dev`, open `/selection.html`) - the "Torus Knot" mesh there is registered with `SelectionManager`'s `{ style: "highlight" }` option specifically to demonstrate this overlay next to `SelectionOutline` on the low-poly primitives.
