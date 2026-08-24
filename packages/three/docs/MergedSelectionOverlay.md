# MergedSelectionOverlay

One shared `THREE.LineSegments` covering many targets at once - a single
draw call regardless of how many targets it covers, unlike building one
[SelectionOutline](./SelectionOutline.md) per target via
[createSelectionOverlay](./createSelectionOverlay.md) (one draw call *each*).

Built for bulk multi-select scenarios outside
[SelectionManager](./SelectionManager.md)'s own single-selection model - its
own overlay never covers more than two targets (selected and hover), so it
has nothing to gain here. The motivating case is a "select N objects at
once" perf mode, like `examples/scripts/demo-stress.ts`'s "Random Selection"
(run `npm run dev`, open `/stress.html`): with hundreds or thousands of
simultaneously selected instances, one overlay per instance would itself
become the dominant draw-call cost.

```ts
import { MergedSelectionOverlay } from "@jolly-pixel/three";

const overlay = new MergedSelectionOverlay({
  parent: scene,
  targets: selectedMeshes,
  color: "#ffffff"
});
// ... selection changes
overlay.dispose();
const next = new MergedSelectionOverlay({ parent: scene, targets: newSelection, color: "#ffffff" });
```

## MergedSelectionOverlayOptions

```ts
export interface MergedSelectionOverlayOptions {
  /**
   * Object every merged vertex is added to - not any single `target`, since
   * the baked geometry already carries every target's own current world
   * transform.
   */
  parent: THREE.Object3D;
  /**
   * Meshes to merge into one overlay. Must be non-empty - construct nothing
   * for an empty selection.
   */
  targets: THREE.Mesh[];
  color: THREE.ColorRepresentation;
  opacity?: number;
  /** Forwarded to the merged `THREE.LineBasicMaterial`. */
  linewidth?: number;
  xray?: boolean;
}
```

## Properties

- `object: THREE.LineSegments` - The merged overlay object, already added to `parent`.

## Methods

- `dispose(): void` - Removes `object` from `parent` and disposes its geometry and material. Does not touch any target's own geometry/material.

## Notes

- Each target's own `EdgesGeometry` is baked into world space (`geometry.applyMatrix4(target.matrixWorld)`) before merging via `BufferGeometryUtils.mergeGeometries`, then added to `parent` at that parent's own origin - unlike `SelectionOutline`, which stays in the target's local space and inherits its transform for free by being parented as its child. That tradeoff is exactly what makes the merge possible: one shared geometry can't simultaneously sit in N different local spaces.
- This is a **static, one-shot bake**, not a live overlay: it does not follow a target that moves after construction, and covers whatever `targets` was given at construction time only. Dispose and reconstruct whenever the covered set (or any covered target's transform) changes - the same rebuild-on-change pattern `createSelectionOverlay`'s own callers already use for their per-target overlays.
- Not applicable to the `"coloredOutline"` technique - that one already costs nothing extra per target (`ColoredOutlinePass.setEntries` takes the whole batch directly), so there is no per-target draw call here to merge away.
- `xray: true` disables `depthTest`/`depthWrite` and raises `renderOrder`, same convention as `SelectionOutline`.
