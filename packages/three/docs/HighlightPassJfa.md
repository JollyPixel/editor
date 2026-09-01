# HighlightPassJfa

Jump Flood Algorithm alternative to [HighlightPass](./HighlightPass.md) - same
[HighlightEntry](./HighlightPass.md#highlightentry)/`setEntries` shape, so a
caller (e.g. [PeerHighlightPass](./PeerHighlightPass.md)) can drive either
technique interchangeably, but replaces `HighlightPass`'s
downsample/edge-detect/blur chain with a real distance field: every
background texel knows the exact pixel-space distance to its nearest
outlined silhouette, so the ring reads the same width regardless of viewing
angle or downsample level, unlike a blurred edge map.

Same overall shape as `HighlightPass` (mask pass, `RenderPipeline`
compositing the ring onto a `pass(scene, camera)`):

1. Mask pass - flat per-entry color, depth-tested, exactly like
   `HighlightPass`'s own non-priority mask pass.
2. Seed init - every masked texel seeds itself (its own pixel coordinate,
   `valid = 1`); every other texel starts invalid.
3. `O(log2(max(width, height)))` Jump Flood passes, each halving the sample
   step, propagating the nearest seed's position (and, via a second,
   parallel pass re-deriving the same nearest-neighbor decision, its color)
   to every texel.
4. Composite - every texel now knows the pixel-space distance to its nearest
   masked seed; a background texel within `ringThickness` of one draws that
   seed's color, with a ~1px smoothstep falloff at the edge.

> [!NOTE]
> Uses TSL and requires `THREE.WebGPURenderer`. Owns its own `RenderPipeline`
> (`render()` replaces `renderer.render(scene, camera)`) - pick one
> whole-frame postprocess pipeline per scene, same caveat as `HighlightPass`.

```ts
import * as THREE from "three/webgpu";
import { HighlightPassJfa } from "@jolly-pixel/three";

const renderer = new THREE.WebGPURenderer({ canvas });
await renderer.init();

const highlightJfa = new HighlightPassJfa(renderer, scene, camera);

highlightJfa.setEntries([
  { target: meshA, color: "#ff0000" },
  { target: meshB, color: "#00aaff" },
  { target: groupC, color: "#22cc55" }, // groups are traversed to every mesh inside them
  { target: instancedMesh, instanceId: 42, color: "#ffaa00" } // one instance of an InstancedMesh
]);

renderer.setAnimationLoop(() => {
  highlightJfa.render(); // replaces renderer.render(scene, camera)
});

// ... later
highlightJfa.dispose();
```

## HighlightPassJfaOptions

```ts
export interface HighlightPassJfaOptions {
  /**
   * Ring thickness, in screen pixels - unlike HighlightPass.edgeThickness
   * (downsampled pixels, blur-kernel-radius-shaped), this is an exact,
   * resolution-independent pixel count: the Jump Flood distance field is a
   * real per-pixel distance to the silhouette, not a blur radius, so the
   * ring reads the same width at any viewing angle or downsample level.
   * @default 2
   */
  ringThickness?: number;
}
```

`HighlightEntry` (`target`/`color`/`priority`/`isolated`/`instanceId`) is
shared with `HighlightPass` - see [its own doc](./HighlightPass.md#highlightentry)
for the full field-by-field breakdown; every field means exactly the same
thing here.

## Methods

- `render(): void` - Renders the mask/seed/Jump-Flood/composite chain for the current entries, then the scene through the outline pipeline. Call this instead of `renderer.render(scene, camera)` in the render loop.
- `get ringThickness(): number` / `setRingThickness(ringThickness: number): void` - Reads/updates the ring's own pixel thickness.
- `setEntries(entries: HighlightEntry[]): void` - Replaces every currently outlined entry - same whole-object group traversal, `priority`/`isolated`/`instanceId` handling as `HighlightPass.setEntries`.
- `dispose(): void` - Frees the GPU resources owned by this pass (render targets, materials, the `RenderPipeline`). Does not touch entries' own geometries/materials.

## Notes

- `pipeline: THREE.RenderPipeline` is exposed read-only.
- **Distance field, not a blur.** Every texel's final ring contribution comes from an actual per-pixel distance to its nearest masked seed (computed via `O(log2(max(width, height)))` Jump Flood propagation passes, ping-ponging two render-target pairs each iteration), not a blurred edge map - the ring reads the exact same pixel width regardless of viewing angle, object distance, or the downsample ratio `HighlightPass`'s own `edgeThickness` is sensitive to. Trade-off: this costs a `FloatType` position buffer (real float precision is needed to compare pixel-coordinate distances correctly - an 8-bit texture would quantize seed positions into a handful of buckets) and `O(log2(max(width, height)))` full-resolution passes per chain, vs. `HighlightPass`'s fixed downsample+blur pass count.
- `priority`/`isolated` entries work exactly like `HighlightPass`'s own - a second, independent mask/seed/propagate chain each, only built/run on a frame with at least one entry of that kind (free otherwise), combined into the final ring via `max()` rather than `add()` for the same double-brightening-avoidance reason.
- **Instanced entries** (`instanceId` set) share the exact same `InstancedHighlightMask` subsystem `HighlightPass` uses - a mask pass's "which instances are entries, what color/priority" concern is identical between both techniques; only what happens to the resulting mask afterward (blur vs. distance field) differs. Net cost per outlined `InstancedMesh`: two draw calls regardless of how many instances are simultaneously outlined, same as `HighlightPass`.
- `setEntries()` does a full replace, not an incremental diff - same caveat as `HighlightPass.setEntries`.
- See `examples/scripts/selection.ts`'s "Peer rendering" -> "colors (postprocess, JFA)" option to compare this technique against `HighlightPass`'s "colors (postprocess, blur)" side-by-side on the same scene/entries.
