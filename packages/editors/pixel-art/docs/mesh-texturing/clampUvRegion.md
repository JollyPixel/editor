# clampUvRegion

Stops a textured mesh from sampling texels outside its UV regions, which shows
as seams from the neighbouring region under MSAA or filtering.

```ts
import * as THREE from "three/webgpu";
import {
  clampUvRegion,
  UVGeometryBinding
} from "@jolly-pixel/editor.pixel-art/mesh-texturing";

const mesh = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshBasicNodeMaterial({ map: texture })
);
clampUvRegion(mesh);

new UVGeometryBinding({
  geometry: mesh.geometry,
  region,
  textureSize,
  faceRanges
});
```

```ts
clampUvRegion(mesh: UvRegionClampedMesh): void
```

`UvRegionClampedMesh` is a `THREE.Mesh` with a `THREE.NodeMaterial`, rendered by
`WebGPURenderer`.

- Adds the `uvRegion` and `uvEdge` attributes if missing and replaces the
  material's `colorNode`. Call it before or after the
  [`UVGeometryBinding`](./UVGeometryBinding.md).
- Each fragment samples the nearest texel centre inside its face's rect; a
  triangle face also stays on its side of the diagonal. Compound regions clamp
  to their bounding rect.
- Changing `material.map` only needs `material.needsUpdate = true`.
- Samples mip level `0` of the first `uv` set: the map's `offset`, `repeat`,
  `rotation`, `center` and `channel` are ignored.
