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
}

class BlockSurface {
  constructor(options?: BlockSurfaceOptions);
  readonly alphaMode: BlockAlphaMode;
  readonly side: BlockSide;
  readonly alphaCutoff: number;
  readonly occludes: boolean;
}
```

| Setting | Default | Behavior |
|---|---|---|
| `alphaMode` | `"opaque"` | Ignores texture alpha. `"mask"` discards uncovered texels; `"blend"` preserves fractional alpha. |
| `side` | `"front"` for opaque, `"double"` otherwise | Shows outward faces only, or both outward and inward faces. |
| `alphaCutoff` | `0.1` for mask, `0` otherwise | Mask texels below the cutoff are discarded before layer opacity is applied. |
| `occludes` | Derived | True only for opaque surfaces; the shape still determines which boundaries are covered. |

The instance is frozen. Invalid modes, sides, or non-finite cutoffs outside
`[0, 1]` throw `RangeError`. Cutoffs are validated even for modes that do not
use them. `BlockRegistry.register()` validates the same settings.

`VoxelEngineOptions.alphaTest` supplies the cutoff for mask blocks without an
explicit `alphaCutoff`. Constructing `BlockSurface` directly uses `0.1`.
Registry definitions retain optional settings; construct a surface when you
need their resolved defaults.

These settings apply to the whole block. Texture slots select tiles but do
not override the surface policy. [`cullSelfFaces`](./BlockDefinition.md)
independently controls shared boundaries.

The legacy block property `transparent` has been removed. Use
`alphaMode: "blend"` for smooth transparency, or `alphaMode: "mask"` for
cutout foliage and grates. Three.js material `transparent` remains an
internal rendering setting.
