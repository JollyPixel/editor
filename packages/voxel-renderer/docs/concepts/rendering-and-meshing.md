# Rendering and meshing

`VoxelView` turns dirty chunks into Three.js meshes. A write marks the affected
chunk and any boundary neighbours dirty, in every layer, since a voxel can hide
or uncover faces of the layers around it. `tick()` rebuilds that queue within the
configured time budget, while `flush()` rebuilds it immediately.

The view reads a [`VoxelDocument`](../api/core/VoxelDocument.md) and subscribes
to it; the document holds the voxels and knows nothing about meshes.
Inside the JollyPixel engine,
[`VoxelRenderer`](../api/engine/VoxelRenderer.md) builds and drives the pair.

See the [`VoxelView` reference](../api/core/VoxelView.md) for lifecycle methods
and configuration.

## Layers sharing chunk meshes

Layers composite into shared meshes. Every visible layer whose position is a
multiple of the chunk size draws into one set of meshes
per chunk cell, so stacking layers does not multiply chunks, geometries, or
draw calls. Faces are still culled and composited per layer, as described in
the [world model](./world-model.md#layer-compositing).

A layer moved off the chunk grid keeps a set of meshes per layer chunk.
Changing its position moves its voxels between the shared cell meshes and its
own.

## Chunk geometry layout

Each chunk cell has one `THREE.Mesh` per tileset and resolved surface policy,
parented to the `"VoxelView:chunks"` group of `VoxelView.root` and positioned
at the cell origin. A `ChunkGeometryKey` pairs the tileset ID with the
surface: alpha mode, sides, mask cutoff and material group. Plain opaque/front
geometry is named after the tileset ID; other surfaces append a `:surface=`
suffix. Tileset IDs must not contain `:surface=`.

Every face is one 8-byte record that the vertex shader expands into a quad (see
[vertex pulling](#vertex-pulling)); triangles repeat their last corner. The
material cache distinguishes resolved surface policies.

Faces touching a block of another [blend group](../api/materials/BlendGroup.md)
go to a separate blended geometry of the same tileset and surface, with a
`:blended` key suffix. Its records take 16 bytes: the extra 8 bytes hold one
palette index per in-plane neighbour, and the geometry carries a small
per-chunk palette of the neighbours' atlas rects and blend settings. Faces
without such a neighbour keep the 8-byte layout and the plain material.

Opaque and masked geometry write depth. Blended blocks use blending without
depth writes, and low-alpha blend texels are preserved.
See [BlockSurface](../api/blocks/BlockSurface.md) for defaults and
[VoxelTransparencyPassNode](../api/core/VoxelTransparencyPassNode.md) for scene
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

`tick()` spends at most `meshing.budgetMs` on dirty chunks during one frame.
The default is 8 ms. A value of `0` rebuilds the entire queue. `focus`
prioritizes chunks near a camera or other point of interest; without it the
queue follows the order chunks were created in, which usually means the far
side of the world is meshed first.

`init()` and `load()` rebuild the complete world synchronously. Use `flush()`
when callers need current meshes before continuing.

With [`meshing.workers`](../api/core/VoxelView.md#mesh-workers), the queue
feeds Web Workers instead. A job carries the chunk and its 26 neighbours in
every visible layer as `SharedArrayBuffer` views of their `VoxelStore`, so
nothing is copied in; the worker runs the same mesher and transfers the face
records back. The main thread only builds the Three.js objects. A job records
the revision of every chunk it read: if one changed before the result is
installed, the result is dropped and the chunk meshed again, which also covers
a worker reading a store mid-write. Each worker numbers its own face templates
and the main thread maps them into the shared table.

## View distance

`range.viewDistance` bounds the work to a chunk radius around `focus`. It is
unlimited by default, and the whole mechanism is inert while `focus` is
`null`.

Chunks outside the radius are never meshed, and stay dirty so they are built
with all their pending edits the moment they come into range. Built chunks
that leave the radius are hidden (`range.policy: "hide"`, the default) or
disposed and remeshed on return (`"unload"`). A one-chunk hysteresis keeps a
chunk on the border from flipping every tick.

Colliders are not affected: a chunk unloaded by the view distance keeps its
collision, so physics is independent of the camera. Frustum culling still
applies on top, and it is what removes the chunks behind the camera; view
distance is about how much is meshed and drawn at all.

## Vertex pulling

A chunk geometry stores one 8-byte record per face. The vertex shader rebuilds
each corner from that record and a shared table of face templates.

A chunk geometry draws one instance of an indexed four-corner quad per face.
The face records sit in an `RG32UI` data texture owned by the geometry, at most
2048 texels wide, and the shader reads them by instance index:

| Channel | Bits | Content |
|---|---|---|
| R | 0-29 | Cell x, y and z relative to the chunk origin, 10 bits each |
| G | 0-21 | Face template ID |
| G | 22-29 | [Ambient occlusion](#ambient-occlusion) level of each corner, 2 bits each |
| G | 30 | Quad diagonal flip |

A face template holds what every copy of a compiled face shares: up to four
block-local corners with their atlas coordinates, the atlas rect, the normal
and the ambient occlusion axes. Templates take 8 `RGBA32F` texels (128 bytes)
each, in one texture shared by every chunk of the view. Faces with the same
content share a template whatever block they come from, including the
triangles cut from partially covered boundary faces. The table only grows: an
edit that changes a face's content, such as a tileset resize, adds templates,
and the table is released with the view.

A `bench/mesh-compare.bench.ts` run on 266k voxels (256² terrain, chunk size
256) meshed 372k faces in 141 ms (min) into 2.8 MB of face records. The
per-vertex attribute layout it replaced took 48.2 MB for the same faces, at
about the same build time: meshing is dominated by neighbour lookups rather
than vertex writes. GPU frame time was not measured.

At runtime, the inspector's `meshMemory` metric reports the same figure for
the live chunks. Three.js files the face records under texture memory rather
than geometry memory, so the renderer's `geometryMemory` alone understates the
cost.

The rest of the package works on the face records:

- Raycasts decode the faces on the CPU. Hits carry no `uv`.
- Colliders receive indexed `position` geometry expanded from the face records,
  relative to the chunk origin.
- The inspector wireframe draws an expanded copy, disposed with the overlay.
- Transparency passes reuse the material's `positionNode`. The shadow pass
  uses `castShadowPositionNode`, which computes the position only.

Chunk geometry has no `uv` or `tileRegion` attribute. Its four-vertex
`position` attribute holds corner indices, drawn through a six-entry index,
and its `normal` attribute is zero-filled. A `rendering.customizer` that reads
geometry attributes, or replaces `positionNode`, breaks the layout.

### Tile shading

Every chunk material gets a TSL color node that confines each face's samples
to its atlas rect, so an MSAA sample taken outside the triangle cannot read a
neighbouring tile. It also lets a face reference a rect at a fractional tile
offset. The node applies the surface's alpha mode and mask cutoff, multiplies
the color by the baked [ambient occlusion](#ambient-occlusion), and filters
[distant tiles](#distant-tiles).

The shadow pass gets its own color graph. Opaque surfaces cast with a constant
color, mask surfaces discard on the raw atlas texel alpha, and neither reads
the distant tile filter or ambient occlusion. A `rendering.customizer` that
replaces `colorNode` also replaces what the shadow pass evaluates.

## Distant tiles

Atlases are sampled with nearest filtering at mip level 0, with no mipmaps:
mips would blend neighbouring tiles. Once a screen pixel covers several
texels, nearest sampling picks one of them almost at random, so far terrain
shimmers and shows moire as the camera moves.

With `rendering.tileMinification: "average"` (the default), chunk materials
box-filter the texels around each pixel instead. The box spans two pixel
footprints, about the support of trilinear mipmapping: a one-pixel box still
turns tile borders into lines and flickers under TRAA jitter. The footprint
comes from the screen derivatives of the texel coordinate, so a face seen at a grazing angle
averages a long thin rect rather than a square, and the rect is clamped to the
face's atlas rect so no neighbouring tile leaks in. A pixel covering less than
one texel keeps the level 0 sample, and the filter fades in between one and
two texels. Rects at fractional offsets, spans and rotations all work, because
the average comes from a summed-area table rather than per-tile storage.

Baked ambient occlusion is filtered the same way. As the box grows to cover a
face, the per-vertex shading fades to the face's mean corner level, so the
darkened creases of a distant staircase do not alias into lines.

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
is released when its source texture is disposed. The table is bilinear inside
each texel, so the shader reads it at fractional coordinates with four nearest
taps per corner: sixteen taps per pixel. Sums are 32-bit floats, which keeps
the average exact to well under a colour step on atlases up to 1024 texels a
side.

RGB is averaged in linear space and weighted by alpha, so transparent texels
do not darken the colour. Cutout (`"mask"`) surfaces test the filtered
coverage against their cutoff, so distant foliage fills in rather than
sparkling. With `rendering.alphaToCoverage` the coverage also becomes MSAA
sample coverage, which softens the edges; it needs a multisampled target and
an opaque canvas, because the coverage is written as alpha.

`refresh()` rebuilds the table when the source texture's `version` moved,
which `TilesetAtlas.updateImage()` does. `VoxelView.tick()` refreshes every
atlas through `TilesetAtlases.refreshAverages()`.

## Normal maps

A tileset can be loaded with a tangent-space normal atlas next to its colour
atlas. The renderer only reads it: generating one is the host's job, whether
the atlas is painted by hand or derived from the pixels.

```ts
view.loadTileset(definition, texture, { normal: normalTexture });
```

The normal atlas has the same layout, size and orientation as the colour
atlas. Normals use the OpenGL convention: red points right and green points up
in the image. `TilesetAtlas` samples it like the colour atlas, nearest and
without mipmaps, but in `NoColorSpace` so the vectors stay linear.

Chunk materials then get a `normalNode`. It samples the normal atlas with the
same clamped and remapped UV as the colour, so [blend
groups](../api/materials/BlendGroup.md), tile rotation and the half-texel inset
stay aligned. The tangent frame comes from the screen derivatives of the view
position and of the texel coordinate, so rotated, flipped, ramp and diagonal
faces need no tangent data. Working in texels keeps both axes at the same
scale in an atlas that is wider than it is tall.

The relief fades to the geometric normal as a pixel starts covering several
texels, with the weight [distant tiles](#distant-tiles) use for their colour,
so far terrain does not shimmer. Flat distant faces past
[`range.farDistance`](#far-distance) have no relief at all.

The strength is the [`normalScale`](../api/materials/MaterialGroup.md) of the
block's material group, `1` without a group. A group with `normalScale: 0`, or
a tileset without a normal atlas, gets no `normalNode`. The shadow pass
ignores the relief. Both the Lambert and the Standard material use it; under
Standard, a low roughness also adds specular highlights on the relief.

## Far distance

`range.farDistance`, measured in chunks from `focus` to a chunk centre, trades
detail for stability far away. It defaults to `Infinity`.

```ts
const view = new VoxelView(document, {
  range: {
    farDistance: 14
  }
});

view.range.farDistance = Infinity; // back to full detail on the next tick
```

Beyond it a chunk draws every face in the flat average colour of its tile,
shaded by its mean ambient occlusion, and
its blend blocks turn opaque, since a whole tile covers a pixel or two by then
and its transparency cannot be seen. Only materials change: the chunk is not
remeshed, and each material variant is shared by every far chunk.

A chunk stays far until it comes half a chunk closer than the threshold, so a
chunk sitting on the border does not flip every tick.

## Ambient occlusion

`lighting.ambientOcclusion` bakes contact shading into the face records, so
creases between blocks darken without a post-processing pass. It is a strength
from `0` (off, the default) to `1`, where a fully enclosed corner turns black.

```ts
const view = new VoxelView(document, {
  lighting: {
    ambientOcclusion: 0.5
  }
});

// Switching on or off rebuilds every chunk; other changes only update a uniform.
view.lighting.ambientOcclusion = 0.8;
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
  alike. A `rendering.customizer` that replaces `colorNode` drops it.

Baking roughly doubles chunk build time; a `bench/mesh-compare.bench.ts` run
on 190k voxels took 124 ms instead of 64 ms. An edit on a chunk edge or corner
also rebuilds the diagonal chunks that sample it.
