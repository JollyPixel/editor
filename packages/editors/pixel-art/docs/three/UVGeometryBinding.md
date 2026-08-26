# UVGeometryBinding

Projects a `UVRegion` onto a `THREE.BufferGeometry`'s `uv` attribute, and optionally keeps it in step as the user drags the region.

```ts
import {
  UVGeometryBinding,
  boxFaceRanges
} from "@jolly-pixel/editor.pixel-art/three/index.ts";

const binding = new UVGeometryBinding({
  geometry: mesh.geometry,
  region,
  textureSize: canvas.textureSize,
  faceRanges: boxFaceRanges()
});
binding.follow(canvas.uv);
```

The constructor snapshots the geometry's `uv` attribute as its projection base and applies the region right away. **Pass geometry whose UVs have not already been rewritten** — a second binding over the same geometry would read the first one's output as its base and compound the projections.

## Face ranges

A `FaceVertexRange` is `{ start, count }` in vertices, naming the slice of the vertex list one UV face owns. `boxFaceRanges()` covers a single-segment `THREE.BoxGeometry`, whose face order (right, left, top, bottom, front, back) is an undocumented property of the class. `rampFaceRanges()` covers the ramp geometry, where the two slanted sides are triangles.

A face with no range is skipped, so a partial map is legal.

## `applyFace()`

```ts
applyFace(face: UVFace | null, geometry: UVGeometry): void
```

A `null` face — what a collapsed region reports — projects the region's shared rect across every vertex. A named face writes only that face's range. `UVGeometry` may be a rectangle or a triangle; triangles are flipped onto the right corner.

## `follow()` / `unfollow()`

`follow(uv)` subscribes to `region-moved`, `region-dragging` and `region-state-changed`, filtered to the bound region's id. `region-dragging` fires on every pointer move, so the geometry tracks the pointer instead of jumping on release. Following a map already followed is a no-op; `unfollow()` is idempotent.

## `setRegion()` / `setTextureSize()`

Both reproject every active face. `setRegion` also changes what `regionId` reports and what `follow()` filters on.
