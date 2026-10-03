# BlockSurface

How a block treats texture alpha and which sides of its faces it draws. The
settings sit on the [block definition](./BlockDefinition.md) and apply to the
whole block.

```ts
document.defineBlock({
  id: 4,
  name: "Leaves",
  shapeId: "cube",
  alphaMode: "mask",
  alphaCutoff: 0.5
});
```

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
| `alphaMode` | `"opaque"` | `"opaque"` ignores texture alpha. `"mask"` discards texels below the cutoff. `"blend"` keeps fractional alpha and writes no depth. |
| `side` | `"front"` for opaque, `"double"` otherwise | Draw the outer side of faces only, or both sides. |
| `alphaCutoff` | the view's `rendering.alphaTest` (`0.1`) for mask, `0` otherwise | Mask threshold, `0` to `1`. |
| `materialGroup` | none | Gives the block its own material on the same atlas, see [`MaterialGroup`](../materials/MaterialGroup.md). Each group adds a draw call per chunk. |
| `occludes` | derived | `true` for opaque surfaces only. The shape still decides which sides are covered. |

Constructing a `BlockSurface` resolves those defaults, with `0.1` as the mask
cutoff. The instance is frozen. An unknown mode or side, a cutoff that is not
finite or outside `0` to `1`, or an empty material group throws `RangeError`;
`BlockRegistry.register()` applies the same checks.

Overlapping blended surfaces need a
[`VoxelTransparencyPassNode`](../core/VoxelTransparencyPassNode.md) to
composite correctly. Which covered faces a block keeps is set separately by
[`cullCoveredFaces`](./BlockDefinition.md#covered-faces).
