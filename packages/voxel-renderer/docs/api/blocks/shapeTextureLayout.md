# Shape texture layout

`shapeTextureLayout(shape)` describes the texture-space footprint authored by a block shape. Each slot carries its normalized bounds, its [span](./BlockShape.md#slanted-faces), source vertex range, and constituent polygon bounds. Triangles also carry their right-angle corner. `isBox` is true only for a six-slot full-tile box.

`resolvedBlockTextureSlots(block, shape)` adds the effective tile for every rendered slot. Resolution follows the renderer's canonical rule: exact slot override, base-slot fallback (for example `top.1` to `top`), then `defaultTexture`. Slots without a usable texture are omitted. A slot that falls back to `defaultTexture` gets a `{ u: 1, v: 1 }` span.

These functions are exported from `@jolly-pixel/voxel.renderer`. Editor integrations should consume this layout instead of inspecting `buildShapeGeometry()` buffers independently.
