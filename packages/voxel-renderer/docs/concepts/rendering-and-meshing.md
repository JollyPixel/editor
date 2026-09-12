# Rendering and meshing

`VoxelEngine` turns dirty chunks into Three.js meshes. A write marks the affected
chunk and any boundary neighbours dirty. `tick()` rebuilds that queue within the
configured time budget, while `flush()` rebuilds it immediately.

See the [`VoxelEngine` reference](../api/core/VoxelEngine.md) for lifecycle methods
and configuration.

## Chunk geometry layout

Each chunk has one `THREE.Mesh` per tileset and resolved surface policy,
parented to `VoxelEngine.root`. A geometry key includes the alpha mode, sides,
and mask cutoff. Plain opaque/front geometry uses the tileset ID; blend/double
geometry keeps the historical `:cutout` suffix. Other policies use a
`:surface=` suffix. Tileset IDs must not end in `:cutout` or contain
`:surface=`.

The non-greedy layout uses 27 bytes per vertex:

| Attribute | Type | Items | Bytes | Notes |
|---|---|---:|---:|---|
| `position` | `float32` | 3 | 12 | Absolute world space |
| `normal` | normalized `int8` | 3 | 3 | Supports non-axis-aligned faces |
| `uv` | normalized `uint16` | 2 | 4 | Atlas coordinates |
| `tileRegion` | normalized `uint16` | 4 | 8 | Atlas offset and scale |

Vertices are not shared between faces, so a cube has 24 vertices. `position`
remains `float32` because raycasting and `mergeChunkGeometries()` read it
directly. Layer opacity is stored on materials. The material cache distinguishes exact
opacity values and resolved surface policies.

Opaque and masked geometry write depth at layer opacity `1`. Blended blocks
and faded layers use blending without depth writes. Mask coverage is tested
before layer opacity; low-alpha blend texels and faint layers are preserved.
See [BlockSurface](../api/blocks/BlockSurface.md) for defaults and
[VoxelTransparencyRenderer](../api/core/VoxelTransparencyRenderer.md) for scene
integration and the limits of weighted color compositing.

## Face culling between identical blocks

A face is dropped when a neighbour covers it. Masked and blended blocks do
not hide faces of different blocks, but `cullSelfFaces: true` removes covered
interfaces between voxels of the same block. Retained double-sided interfaces
are split into opposing front-sided shared pieces and double-sided exposed
pieces. This preserves each direction's texture without blending two copies
of the same boundary from one direction. Gaps between slabs stay visible.

## Rebuild scheduling

`tick()` spends at most `rebuildBudgetMs` on dirty chunks during one frame.
The default is 8 ms. A value of `0` rebuilds the entire queue. `focus`
prioritizes chunks near a camera or other point of interest; without it the
queue follows the order chunks were created in, which usually means the far
side of the world is meshed first.

`init()` and `load()` rebuild the complete world synchronously. Use `flush()`
when callers need current meshes before continuing.

## View distance

`viewDistance` bounds the work to a chunk radius around `focus`. It is
unlimited by default, and the whole mechanism is inert while `focus` is
`null`.

Chunks outside the radius are never meshed, and stay dirty so they are built
with all their pending edits the moment they come into range. Built chunks
that leave the radius are hidden (`viewDistancePolicy: "hide"`, the default)
or disposed and remeshed on return (`"unload"`). A one-chunk hysteresis keeps
a chunk on the border from flipping every tick.

Colliders are not affected: a chunk unloaded by the view distance keeps its
collision, so physics is independent of the camera. Frustum culling still
applies on top, and it is what removes the chunks behind the camera; view
distance is about how much is meshed and drawn at all.

## Greedy meshing

With `greedy: true`, adjacent identical faces are merged into the largest
available rectangle. Merging stays inside one chunk and applies to full, flat
faces such as cubes and slabs. Slopes, poles, transformed voxels, and double-sided surfaces remain
separate. Double-sided boundaries may need polygon splitting.

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
  material: TileWrappedMaterial,
  surface?: BlockSurface
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

### Tile clamping

```ts
function enableTileClamping(
  material: TileWrappedMaterial,
  surface?: BlockSurface
): void;
```

Chunk materials outside greedy mode get `enableTileClamping()` instead. It
confines each face's samples to the `tileRegion` attribute's rect, so an MSAA
sample taken outside the triangle cannot read a neighbouring tile. This is what
lets atlases ship without a gutter, and therefore what lets a face reference a
rect at a fractional tile offset. See
[atlas padding](./atlas-padding.md).

The optional `surface` applies alpha-mode and mask-cutoff behavior to the
shader. The engine supplies it when creating chunk materials.
