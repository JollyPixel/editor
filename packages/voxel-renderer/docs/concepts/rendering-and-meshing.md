# Rendering and meshing

`VoxelEngine` turns dirty chunks into Three.js meshes. A write marks the affected
chunk and any boundary neighbours dirty, in every layer, since a voxel can hide
or uncover faces of the layers around it. `tick()` rebuilds that queue within the
configured time budget, while `flush()` rebuilds it immediately.

See the [`VoxelEngine` reference](../api/core/VoxelEngine.md) for lifecycle methods
and configuration.

## Chunk geometry layout

Each chunk has one `THREE.Mesh` per tileset and resolved surface policy,
parented to `VoxelEngine.root` and positioned at the chunk origin. A geometry key includes the alpha mode, sides,
and mask cutoff. Plain opaque/front geometry uses the tileset ID; blend/double
geometry keeps the historical `:cutout` suffix. Other policies use a
`:surface=` suffix. Tileset IDs must not end in `:cutout` or contain
`:surface=`.

The non-greedy layout uses 28 bytes per vertex:

| Attribute | Type | Items | Bytes | Notes |
|---|---|---:|---:|---|
| `position` | `float32` | 3 | 12 | Relative to the chunk origin |
| `normal` | normalized `int8` | 4 | 4 | Fourth byte unused; WebGPU needs 4-byte strides |
| `uv` | normalized `uint16` | 2 | 4 | Atlas coordinates |
| `tileRegion` | normalized `uint16` | 4 | 8 | Atlas offset and scale |

Every face is stored as a quad: triangles repeat their last vertex, and all
chunk geometries share CPU quad-index storage. Each geometry owns a separate
index attribute limited to its used indices, so Three.js can release its GPU
buffer independently when the geometry is disposed.
Vertices are not shared between faces, so a cube has 24 vertices. `position`
remains `float32` because raycasting and `mergeChunkGeometries()` read it
directly. Once a chunk has rendered, its `tileRegion` and `tileRepeat` arrays
are released from JavaScript memory unless `retainVertexData` is set. Layer
opacity is stored on materials. The material cache distinguishes exact
opacity values and resolved surface policies.

Opaque and masked geometry write depth at layer opacity `1`. Blended blocks
and faded layers use blending without depth writes. Mask coverage is tested
before layer opacity; low-alpha blend texels and faint layers are preserved.
See [BlockSurface](../api/blocks/BlockSurface.md) for defaults and
[VoxelTransparencyRenderer](../api/core/VoxelTransparencyRenderer.md) for scene
integration and the limits of weighted color compositing.

## Culling covered faces

A face is dropped when an opaque neighbour covers it. Masked and blended
blocks do not hide faces of different blocks. They keep their own covered
faces by default; `cullCoveredFaces: true` removes the interfaces between
voxels of the same block and the faces an opaque neighbour covers. Retained
double-sided interfaces are split into opposing front-sided shared pieces and
double-sided exposed pieces. This preserves each direction's texture without
blending two copies of the same boundary from one direction. Gaps between
slabs stay visible.

A retained face covered by an opaque neighbour is coplanar with that
neighbour's face. Mask and blend materials carry a polygon offset of `-1` so
the retained face wins the depth test.

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

With `greedy: true`, adjacent faces that look identical are merged into the
largest available rectangle, whatever block or transform they come from.
Merging stays inside one chunk and applies to full, flat faces such as cubes
and slabs. Slopes and poles remain separate. Double-sided faces merge where
they open onto air; against a neighbour they may need polygon splitting.

Greedy mode uses 36 bytes per vertex:

| Attribute | Type | Items | Bytes | Notes |
|---|---|---:|---:|---|
| `uv` | `float32` | 2 | 8 | Tile space (`0..span`) |
| `tileRegion` | normalized `uint16` | 4 | 8 | Atlas offset and scale |
| `tileRepeat` | normalized `uint16` | 2 | 4 | Repeat count per axis, rescaled by 65535 in the shader |

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
sample taken outside the triangle cannot read a neighbouring tile. It also lets a face
reference a rect at a fractional tile offset.

The optional `surface` applies alpha-mode and mask-cutoff behavior to the
shader. The engine supplies it when creating chunk materials.
