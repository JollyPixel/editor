# clampUvRegion

Stops a textured mesh from sampling texels outside its UV regions. Without it, MSAA edge samples and texture filtering at a face's border can pick up the neighbouring region's pixels and show them as a seam.

```ts
import * as THREE from "three/webgpu";
import {
  clampUvRegion,
  UVGeometryBinding
} from "@jolly-pixel/editor.pixel-art/mesh-texturing/index.ts";

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

`UvRegionClampedMesh` is a `THREE.Mesh` with a `THREE.NodeMaterial`, rendered by `WebGPURenderer`.

The call adds the `uvRegion` and `uvEdge` vertex attributes the shader reads, if the geometry does not have them yet, and replaces the material's `colorNode`. A [`UVGeometryBinding`](./UVGeometryBinding.md) writes the same attributes, so the two can be set up in either order. Until a region is written, every vertex stays unclamped. After that, each fragment samples the nearest texel centre inside its face's rect, and a triangle face also stays on its side of the diagonal. Compound regions are clamped to their bounding rect only.

The color node is built once and reads `map` and `color` from the material each time the shader is compiled. Setting `material.map` to another texture or to `null` only needs `material.needsUpdate = true`, not a second call. With no map, the material renders its plain `color`.

Sampling always uses mip level `0` and the mesh's first `uv` set as written by the binding: the map's `offset`, `repeat`, `rotation`, `center` and `channel` are ignored.
