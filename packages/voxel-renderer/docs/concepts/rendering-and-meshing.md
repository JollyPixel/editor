# Rendering and meshing

`VoxelView` turns dirty chunks into Three.js meshes. A write marks the affected
chunk and any boundary neighbours dirty, in every layer, since a voxel can hide
or uncover faces of the layers around it. `tick()` rebuilds that queue within the
configured time budget, while `flush()` rebuilds it immediately.

The view reads a [`VoxelDocument`](../api/core/VoxelDocument.md) and subscribes
to it; the document holds the voxels and knows nothing about meshes.
[`VoxelEngine`](../api/core/VoxelEngine.md) composes the pair for applications
that want a single object.

See the [`VoxelView` reference](../api/core/VoxelView.md) for lifecycle methods
and configuration.

## Chunk geometry layout

Each chunk has one `THREE.Mesh` per tileset and resolved surface policy,
parented to the `"VoxelView:chunks"` group of `VoxelView.root` and positioned
at the chunk origin. A `ChunkGeometryKey` pairs the tileset ID with the
surface: alpha mode, sides, mask cutoff and material group. Plain opaque/front
geometry is named after the tileset ID; other surfaces append a `:surface=`
suffix. Tileset IDs must not contain `:surface=`.

The non-greedy layout uses 28 bytes per vertex:

| Attribute | Type | Items | Bytes | Notes |
|---|---|---:|---:|---|
| `position` | `float32` | 3 | 12 | Relative to the chunk origin |
| `normal` | normalized `int8` | 4 | 4 | Fourth byte holds [ambient occlusion](#ambient-occlusion), 1 when lit |
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
chunks increase that cost. With ambient occlusion enabled, faces only merge
when their corner shading matches.

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
  surface?: BlockSurface,
  aoStrength?: UniformNode<number>,
  averages?: THREE.Texture | null
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
  surface?: BlockSurface,
  aoStrength?: UniformNode<number>,
  averages?: THREE.Texture | null
): void;
```

Chunk materials outside greedy mode get `enableTileClamping()` instead. It
confines each face's samples to the `tileRegion` attribute's rect, so an MSAA
sample taken outside the triangle cannot read a neighbouring tile. It also lets a face
reference a rect at a fractional tile offset.

The optional `surface` applies alpha-mode and mask-cutoff behavior to the
shader. The optional `aoStrength`, a TSL `uniform()`, multiplies the color by
the baked ambient occlusion. The optional `averages`, an
`AtlasAverages.texture`, turns on [distant tile](#distant-tiles) fading. The
engine supplies all three when creating chunk materials.

## Distant tiles

Atlases are sampled with nearest filtering at mip level 0, with no mipmaps: a
wrapped greedy UV jumps at every repeat, and mips would blend neighbouring
tiles. Once a screen pixel covers several texels, nearest sampling picks one of
them almost at random, so far terrain shimmers and shows moire as the camera
moves.

With `tileMinification: "average"` (the default), chunk materials fade each
face toward the average colour of its atlas rect instead. The blend weight is
`log2(footprint) / log2(rectSize)`, where `footprint` is the texels covered by
one pixel. It is 0 up close and reaches the full average when one pixel covers
the whole tile: the two ends of a mip chain, without mipmaps or atlas padding.
Rects at fractional offsets, spans and rotations all work, because the
average comes from a summed-area table rather than per-tile storage.

```ts
class AtlasAverages {
  static of(source: THREE.Texture): AtlasAverages | null;
  static peek(source: THREE.Texture): AtlasAverages | undefined;

  readonly texture: THREE.DataTexture; // RGBA float, (width + 1) x (height + 1)

  refresh(): boolean;
  average(x0: number, y0: number, x1: number, y1: number): [number, number, number, number];
  dispose(): void;
}
```

`AtlasAverages.of()` builds one table per atlas texture and shares it. It
reads the pixels from `DataTexture` data or through a 2D canvas, and returns
null when that is impossible (no canvas, cross-origin image). The face then
keeps plain nearest sampling. The table costs 16 bytes per atlas texel, and it
is released when its source texture is disposed.

RGB is averaged in linear space and weighted by alpha, so transparent texels
do not darken the colour. Cutout (`"mask"`) surfaces still test the level 0
alpha, so their silhouettes do not thin out with distance, though their edges
still alias.

`refresh()` rebuilds the table when the source texture's `version` moved,
which `TilesetAtlas.updateImage()` does. `VoxelView.tick()` refreshes every
atlas through `TilesetManager.refreshAverages()`.

## Ambient occlusion

`ambientOcclusion` bakes contact shading into chunk vertices, so creases
between blocks darken without a post-processing pass. It is a strength from
`0` (off, the default) to `1`, where a fully enclosed corner turns black.

```ts
const engine = new VoxelEngine({
  ambientOcclusion: 0.5
});

// Switching on or off rebuilds every chunk; other changes only update a uniform.
engine.ambientOcclusion = 0.8;
```

Each face corner looks at the three cells around it in the layer in front of
the face: two sides and the diagonal. Every occluder lowers the corner by one
level out of three, and two occluding sides darken it fully. Vertices between
corners, such as the top edge of a slab side, interpolate the four corners. The
quad is triangulated along the diagonal joining its two brighter corners, so
the shading stays symmetric.

- A cell occludes when its block fully covers at least one of its faces.
  Cutout blocks and thin shapes such as poles cast nothing.
- Only faces on the voxel boundary receive occlusion. Ramp slopes and the inner
  step of a stair stay lit, since their crease lies inside a single cell.
- The shading multiplies the albedo, so it darkens direct and indirect light
  alike. A `materialCustomizer` that replaces `colorNode` drops it.

Baking roughly doubles chunk build time; a
`bench/mesh-compare.bench.ts` run on 190k voxels took 124 ms instead of 64 ms.
Greedy meshing merges fewer faces (310k triangles instead of 168k in that
run). An edit on a chunk edge or corner also rebuilds the diagonal chunks
that sample it.
