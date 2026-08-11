# ColoredOutlinePass

Scene-level postprocess outline that renders many simultaneously outlined
objects, each in its own arbitrary color, in a single shared mask +
edge-detection pass. Unlike [ToonOutlinePass](./ToonOutlinePass.md) (built on
three's stock `OutlineNode`), which is one shared pipeline per *color* (its
own "selected" and "hovered" roles), representing N distinct colors there
would mean N separate `OutlineNode` instances - and `OutlineNode` re-renders
the entire non-selected scene into a depth buffer every frame just to
determine occlusion, so N colors would mean paying that cost N times.

This class never re-renders the rest of the scene: its mask pass draws only
the objects currently passed to `setEntries`, via the same
`renderer.setRenderObjectFunction` override technique `OutlineNode` itself
uses internally, just swapping in each object's own color instead of a fixed
one. Cost scales with how many outlined objects are actually visible this
frame - not total scene size, not how many peers are connected, not how many
distinct colors are in use (three's own scene traversal already skips
anything outside the camera frustum before the mask pass ever sees it, the
same free culling `OutlineNode`'s own mask pass relies on).

> [!NOTE]
> Uses TSL and requires `THREE.WebGPURenderer`. Owns its own `RenderPipeline`
> (`render()` replaces `renderer.render(scene, camera)`), like
> `ToonOutlinePass` - see that class's own doc comment for why that means it
> can't currently run in the same frame as a separate `ToonOutlinePass`.

Deliberately has no notion of peers, [SelectionManager](./SelectionManager.md),
or [PeerSelectionRegistry](./PeerSelectionRegistry.md) - it only ever paints
colored outlines around whatever `{ target, color }` entries it's given, the
same agnostic-core-vs-thin-glue split `PeerSelectionRegistry` already uses.
[PeerColoredOutline](./PeerColoredOutline.md) is the thin adapter that feeds
it from the selection system.

```ts
import * as THREE from "three/webgpu";
import { ColoredOutlinePass } from "@jolly-pixel/three";

const renderer = new THREE.WebGPURenderer({ canvas });
await renderer.init();

const coloredOutline = new ColoredOutlinePass(renderer, scene, camera);

coloredOutline.setEntries([
  { target: meshA, color: "#ff0000" },
  { target: meshB, color: "#00aaff" },
  { target: groupC, color: "#22cc55" }, // groups are traversed to every mesh inside them
  { target: instancedMesh, instanceId: 42, color: "#ffaa00" } // one instance of an InstancedMesh
]);

renderer.setAnimationLoop(() => {
  coloredOutline.render(); // replaces renderer.render(scene, camera)
});

// ... later
coloredOutline.dispose();
```

## ColoredOutlineEntry

```ts
export interface ColoredOutlineEntry {
  /**
   * Mesh (or group, traversed to every mesh inside it) to outline.
   */
  target: SelectableObject;
  /**
   * This entry's own outline color - unlike ToonOutlinePass, every entry
   * carries its own color rather than sharing one or two fixed roles.
   */
  color: THREE.ColorRepresentation;
  /**
   * When two entries' silhouettes overlap on screen, the mask pass has no
   * depth test to resolve which one should win there - without this, the
   * winner is whichever happens to draw last during three's own scene
   * traversal, unrelated to which entry actually matters more to the
   * caller. Setting this true draws the entry again in a second pass after
   * every non-priority entry, so it always wins the overlap. Typical use:
   * the local user's own selection, so it stays visibly outlined even where
   * a peer's selection overlaps it on screen.
   * @default false
   */
  priority?: boolean;
  /**
   * Selects a single instance of a `THREE.InstancedMesh` `target`, instead
   * of outlining `target` as a whole - required when `target` is a
   * `THREE.InstancedMesh` (it has no meaningful "whole object" mask, since
   * it draws many distinct instances in one object) and must be omitted for
   * any other `target`. See this class's own Notes for why many
   * simultaneously-outlined instances of the same mesh still cost only two
   * draw calls total, not one per instance.
   */
  instanceId?: number;
}
```

## ColoredOutlinePassOptions

```ts
export interface ColoredOutlinePassOptions {
  /**
   * @default 1
   */
  edgeThickness?: number;
  /**
   * @default 0
   */
  edgeGlow?: number;
  /**
   * @default 2
   */
  downSampleRatio?: number;
}
```

## Methods

- `render(): void` - Renders the mask/edge-detection passes for the current entries, then the scene through the outline pipeline. Call this instead of `renderer.render(scene, camera)` in the render loop.
- `get edgeThickness(): number` / `setEdgeThickness(edgeThickness: number): void` - Reads/updates the detected-edge thickness.
- `get edgeGlow(): number` / `setEdgeGlow(edgeGlow: number): void` - Reads/updates the animated glow/pulse multiplier.
- `setEntries(entries: ColoredOutlineEntry[]): void` - Replaces every currently outlined entry. Traverses each `target` (group support) into a flat mesh-to-color map (plus the set of `priority` meshes), cached until the next call rather than rebuilt every frame.
- `dispose(): void` - Frees the GPU resources owned by this pass (render targets, materials, the `RenderPipeline`). Does not touch entries' own geometries/materials.

## Notes

- `pipeline: THREE.RenderPipeline` is exposed read-only, same as `ToonOutlinePass`.
- `priority` entries are redrawn in a second mask pass, only when at least one entry is marked `priority` - free (skipped entirely) otherwise. That second pass uses its own `depthTest: false` material (not the first pass's normal, depth-tested one) and `renderer.autoClear = false`, so it always wins the shared mask buffer at every pixel it covers - including where a non-priority entry is actually nearer to the camera on screen. Without the disabled depth test, the priority redraw would still lose to a nearer peer's already-written depth from the first pass, defeating the point of "priority" entirely. Meant for a handful of entries (e.g. the local user's own selection), not a general z-ordering system - every priority entry still shares one pass among them with depth testing off, so their own mutual overlap order is traversal-order-dependent, same as non-priority entries are among themselves in the first pass.
- The mask pass temporarily clears `scene.background` to `null` for the duration of both mask render calls (restored immediately after). Three's own `Background.update()` forces a full color+depth clear on *every* `renderer.render()` call whenever `scene.background` is an opaque `Color` - regardless of `renderer.autoClear` - so left alone, the priority second pass's `autoClear = false` would be silently overridden and wipe out every non-priority entry the first pass just drew. This only matters for scenes with an opaque `Color` background (the common case); a `backgroundNode` (skybox/texture) doesn't trigger it.
- **v1 scope: no occlusion-aware hidden edge / `xray` support.** Every entry always reads as fully visible, regardless of what's in front of it - unlike `SelectionOutline`/`SelectionHighlight`/`ToonOutlinePass`, all of which support `xray`. Adding it later would reuse the main scene pass's own depth texture (`pass(scene, camera).getTextureNode("depth")`) rather than repeating `OutlineNode`'s redundant depth pre-pass, but it's deferred here to keep this class scoped to what it was actually built for: many simultaneous distinct colors, performant.
- Edge-detection boundary strength comes from the RGB *distance* between neighboring mask texels, not from `maskWeight`'s (background-vs-masked) signal - two different entry colors can have near-identical RGB length (e.g. orange `(.98,.42,.42)` and teal `(.16,.80,.83)`, both length ~1.15) despite being visually distinct, which would otherwise silently drop the edge between two adjacent, differently-colored selections and only ever detect mask-vs-background boundaries. RGB distance catches both cases. At a boundary where two different colors meet (two peers' outlines touching), the shader still blends the neighboring colors' weighted average for the edge's own color rather than picking one - a known, accepted approximation, not a bug; only the *detection* of that boundary needed fixing, not the color chosen once it's found.
- The "is this pixel masked" signal used for that weighted-average color and for the composite's own-surface gate is each mask-buffer texel's RGB length (`maskWeight`), not the mask render target's own alpha channel - `setClearColor(color, 0)` did not reliably clear this particular render target's alpha to 0 on the renderer this was built against (sampling alpha in a downstream shader read back 1 everywhere, drawn pixels and background alike, verified empirically). RGB itself clears to true black correctly, so its length works as a stand-in. Practical implication: don't assign pure/near-black (`#000000`) as an entry's color - it would read as unmasked.
- `setEntries()` does a full replace, not an incremental diff - fine for click-driven selection changes (inherently low frequency), but not a technique to reuse as-is for something higher-frequency like live hover broadcast without reconsidering the cost of rebuilding/re-traversing the whole entries list on every change.
- **Instanced entries** (`instanceId` set): rather than one draw call per outlined instance, each `InstancedMesh` referenced by any instanced entry gets one dedicated set of `THREE.InstancedBufferAttribute`s (per-instance mask color, plus a per-instance "is this an entry" flag) read via TSL's `instancedBufferAttribute()` - the same low-level technique three's own `instance()` helper uses internally for `InstancedMesh.instanceColor`, just aimed at buffers this class owns instead. Deliberately *not* `mesh.instanceColor` itself - three auto-multiplies every material's diffuse color by `instanceColor` when it's set (`NodeMaterial.setupDiffuseColor`), which would leak into the mesh's own normal scene rendering and tint every non-outlined instance pure black. Every non-outlined instance is `Discard()`-ed in the mask pass's own shader, not just zeroed - instancing draws every instance of the mesh in one call regardless of which ones are entries, so a color-only approach would still write those instances' real depth into the mask target, letting them occlude an actually-outlined instance (or an unrelated whole-object entry) behind them and silently break the no-occlusion guarantee below. The whole mesh still redraws in the priority second pass whenever *any* instanced entry references it, regardless of whether any of its instances are actually `priority` - a dedicated per-instance flag attribute discards every non-priority instance's fragments in that pass's own shader too, so a mesh with no priority instances just costs one harmless all-discarded draw call rather than needing a separate "does this mesh need the second pass" check. Net cost per outlined `InstancedMesh`: two draw calls (one per pass) regardless of how many of its instances are simultaneously outlined - same shape as the whole-object case, just per mesh instead of per outlined object.
- See `examples/scripts/demo-stress.ts` (run `npm run dev`, open `/stress.html`) - the "Peer Colors" pane folder wires this class against the same heavy-instance stress rig used to compare it against `outline`/`highlight`/`toonOutline`, so instances, peer count, and the local user's own click-selection can all be pushed at once. That demo resolves peer/local selections into instanced entries itself rather than through `PeerColoredOutline` - see the demo's own `refreshPeerColors` for why: `PeerColoredOutline` resolves every id through `SelectionManager.targetFor`, which only ever returns a whole object, never a single `InstancedMesh` instance.
