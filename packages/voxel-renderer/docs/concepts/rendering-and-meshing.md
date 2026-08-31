# Rendering and meshing

`VoxelEngine` turns dirty chunks into Three.js meshes. A write marks the affected
chunk and any boundary neighbours dirty. `tick()` rebuilds that queue within the
configured time budget, while `flush()` rebuilds it immediately.

See the [`VoxelEngine` reference](../api/core/VoxelEngine.md) for lifecycle methods
and configuration.

## Chunk geometry layout

Each chunk has one `THREE.Mesh` per tileset and cutout mode, parented to
`VoxelEngine.root`. A draw group is identified by its tileset id, with a
`:cutout` suffix for the transparent half, so a mesh is named
`voxel_chunk_<chunk>:<tileset>[:cutout]`. A tileset id may therefore not end in
`:cutout`. The standard layout uses 19 bytes per vertex:

| Attribute | Type | Items | Bytes | Notes |
|---|---|---:|---:|---|
| `position` | `float32` | 3 | 12 | Absolute world space |
| `normal` | normalized `int8` | 3 | 3 | Supports non-axis-aligned faces |
| `uv` | normalized `uint16` | 2 | 4 | Atlas coordinates |

Vertices are not shared between faces, so a cube has 24 vertices. `position`
remains `float32` because raycasting and `mergeChunkGeometries()` read it
directly. Layer opacity is stored on materials. Materials are cached in 32
opacity buckets.

## Rebuild scheduling

`tick()` spends at most `rebuildBudgetMs` on dirty chunks during one frame.
The default is 8 ms. A value of `0` rebuilds the entire queue. `rebuildFocus`
prioritizes chunks near a camera or other point of interest.

`init()` and `load()` rebuild the complete world synchronously. Use `flush()`
when callers need current meshes before continuing.

## Greedy meshing

With `greedy: true`, adjacent identical faces are merged into the largest
available rectangle. Merging stays inside one chunk and applies to full, flat
faces such as cubes and slabs. Slopes, poles, and transformed voxels remain
separate.

Greedy mode uses 35 bytes per vertex:

| Attribute | Type | Items | Bytes | Notes |
|---|---|---:|---:|---|
| `uv` | `float32` | 2 | 8 | Tile space (`0..span`) |
| `tileRegion` | normalized `uint16` | 4 | 8 | Atlas offset and scale |
| `tileRepeat` | `uint16` | 2 | 4 | Repeat count per axis |

The extra attributes let the shader repeat one atlas tile across a merged face.
A `materialCustomizer` that replaces `onBeforeCompile` or remaps texture UVs
conflicts with this shader modification.

Greedy meshing allocates a scratch grid proportional to `chunkSize³`. Large
chunks increase that cost, and the approach does not support per-vertex lighting
or ambient occlusion.

```ts
const engine = new VoxelEngine({
  chunkSize: 32,
  greedy: true
});

// Changing the mode rebuilds every chunk and replaces the materials.
engine.greedy = false;
```

### Tile wrapping for custom materials

Greedy meshing uses tile-space UVs across merged faces. `enableTileWrapping()`
modifies a supported custom material so one atlas cell repeats instead of
stretching.

```ts
type TileWrappedMaterial =
  | THREE.MeshLambertMaterial
  | THREE.MeshStandardMaterial;

function enableTileWrapping(
  material: TileWrappedMaterial
): void;
```

The material must already have a `map`. The function does nothing when the map
is missing. It installs a Three.js TSL color node that reads the `tileRegion`
and `tileRepeat` geometry attributes emitted by greedy meshing.

The shader samples mip level 0 because UV wrapping introduces derivative
discontinuities at each repeat. Calling code should not replace the material's
`onBeforeCompile` or remap its texture UVs after enabling wrapping.

Applications normally use this indirectly through `VoxelEngine({ greedy: true })`.
The export is available for compatible custom material setup.
