# UVGeometryBinding

Projects a `UVRegion` onto a `THREE.BufferGeometry`'s `uv` attribute and can
follow the region as it is edited.

```ts
import { UVGeometryBinding } from "@jolly-pixel/editor.pixel-art/mesh-texturing";

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

- The constructor snapshots the geometry's `uv` as its base and applies the
  region. Pass geometry whose UVs were not rewritten yet: a second binding on
  the same geometry compounds the projections.
- Each write also fills the `uvRegion` and `uvEdge` attributes that
  [`clampUvRegion()`](./clampUvRegion.md) reads.

## Face ranges

```ts
interface FaceVertexRange {
  start: number; // in vertices
  count: number;
}

type FaceRanges = Partial<Record<UVSlot, readonly FaceVertexRange[]>>;
```

- A face can own several ranges, such as a stair top split into two quads.
- A face with no ranges is skipped.
- Base UVs are scaled into the target rect, so a base UV of `0.5` lands halfway.
- `buildShapeGeometry()` from `@jolly-pixel/voxel.renderer` returns ranges for a
  `BlockShape`.

## Methods

### applyFace(face: UVSlot | null, geometry: UVGeometry): void

`null`, from a stacked region, projects the shared rect across every vertex.

### preview(region: UVRegion): void

Projects `region` without adopting it, such as a peer's drag. A region with
another id is ignored.

### follow(uv: UVMap): void / unfollow(): void

Reprojects on region moves, drags, state changes and rotations of the bound
region. Both are idempotent.

### bindRegion(region: UVRegion): void / resizeTexture(size: Vec2): void

Reproject every active face. `bindRegion()` also changes `regionId` and what
`follow()` listens to.
