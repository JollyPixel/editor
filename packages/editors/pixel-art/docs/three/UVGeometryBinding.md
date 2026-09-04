# UVGeometryBinding

Projects a `UVRegion` onto a `THREE.BufferGeometry`'s `uv` attribute, and optionally keeps it in step as the user drags the region.

```ts
import { UVGeometryBinding } from "@jolly-pixel/editor.pixel-art/three/index.ts";

const binding = new UVGeometryBinding({
  geometry: mesh.geometry,
  region,
  textureSize: canvas.textureSize,
  faceRanges: {
    front: [{ start: 0, count: 4 }],
    top: [{ start: 4, count: 4 }]
  }
});
binding.follow(canvas.uv);
```

The constructor snapshots the geometry's `uv` attribute as its projection base and applies the region right away. **Pass geometry whose UVs have not already been rewritten** — a second binding over the same geometry would read the first one's output as its base and compound the projections.

## Face ranges

A `FaceVertexRange` is `{ start, count }` in vertices, naming a slice of the vertex list one UV face owns. `FaceRanges` maps a face to a *list* of those slices, because a shape may emit several polygons into the same face slot; a stair, for instance, splits its top into two quads.

A face with no ranges is skipped, so a partial map is legal.

Base UVs are read as normalized tile space and scaled into the target rect rather than snapped to its corners. A vertex whose base UV is `0.5` therefore lands halfway across the rect, which is what lets a shape sample only part of its tile.

Building the ranges is the caller's job, since they depend on how the geometry was assembled. `@jolly-pixel/voxel.renderer` exposes `buildShapeGeometry()`, which triangulates a `BlockShape` and returns the matching per-face ranges.

## `applyFace()`

```ts
applyFace(face: UVFace | null, geometry: UVGeometry): void
```

A `null` face — what a collapsed region reports — projects the region's shared rect across every vertex. A named face writes only that face's ranges. `UVGeometry` may be a rectangle or a triangle; triangles are flipped onto the right corner.

## `follow()` / `unfollow()`

`follow(uv)` subscribes to `region-moved`, `region-dragging` and `region-state-changed`, filtered to the bound region's id. `region-dragging` fires on every pointer move, so the geometry tracks the pointer instead of jumping on release. Following a map already followed is a no-op; `unfollow()` is idempotent.

## `setRegion()` / `setTextureSize()`

Both reproject every active face. `setRegion` also changes what `regionId` reports and what `follow()` filters on.
