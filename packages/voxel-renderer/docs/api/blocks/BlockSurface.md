# BlockSurface

`BlockSurface` resolves the alpha and face-side settings on a block. It is
exported from `@jolly-pixel/voxel.renderer` with these types:

```ts
type BlockAlphaMode = "opaque" | "mask" | "blend";
type BlockSide = "front" | "double";

interface BlockSurfaceOptions {
  alphaMode?: BlockAlphaMode;
  side?: BlockSide;
  alphaCutoff?: number;
  materialGroup?: string;
}

class BlockSurface {
  constructor(options?: BlockSurfaceOptions);
  readonly alphaMode: BlockAlphaMode;
  readonly side: BlockSide;
  readonly alphaCutoff: number;
  readonly materialGroup?: string;
  readonly occludes: boolean;
}
```

| Setting | Default | Behavior |
|---|---|---|
| `alphaMode` | `"opaque"` | Ignores texture alpha. `"mask"` discards uncovered texels; `"blend"` preserves fractional alpha. |
| `side` | `"front"` for opaque, `"double"` otherwise | Shows outward faces only, or both outward and inward faces. |
| `alphaCutoff` | `0.1` for mask, `0` otherwise | Mask texels below the cutoff are discarded before layer opacity is applied. |
| `materialGroup` | None | Gives the block its own chunk material on the same atlas, shared with every block naming the same group. |
| `occludes` | Derived | True only for opaque surfaces; the shape still determines which boundaries are covered. |

The instance is frozen. Invalid modes, sides, non-finite cutoffs outside
`[0, 1]`, or an empty or non-string material group throw `RangeError`. Cutoffs are validated even for modes that do not
use them. `BlockRegistry.register()` validates the same settings.

`VoxelEngineOptions.alphaTest` supplies the cutoff for mask blocks without an
explicit `alphaCutoff`. Constructing `BlockSurface` directly uses `0.1`.
Registry definitions retain optional settings; construct a surface when you
need their resolved defaults.

These settings apply to the whole block. Texture slots select tiles but do
not override the surface policy. [`cullCoveredFaces`](./BlockDefinition.md)
independently controls the faces a neighbour covers.

A material group lets one atlas carry materials tuned apart. The
`materialCustomizer` receives the surface, so it can read the group:

```ts
const engine = new VoxelEngine({
  material: "standard",
  blocks: [
    { id: 1, name: "Sandstone", shapeId: "cube", defaultTexture },
    { id: 2, name: "Gold", shapeId: "cube", defaultTexture, materialGroup: "gold" }
  ],
  materialCustomizer(material, _tilesetId, surface) {
    if (
      material instanceof THREE.MeshStandardMaterial &&
      surface.materialGroup === "gold"
    ) {
      material.metalness = 1;
    }
  }
});
```

Each group adds a draw call per chunk and greedy faces never merge across
groups.

The legacy block property `transparent` has been removed. Use
`alphaMode: "blend"` for smooth transparency, or `alphaMode: "mask"` for
cutout foliage and grates. Three.js material `transparent` remains an
internal rendering setting.
