# Rendering and meshing

A [`VoxelView`](../api/core/VoxelView.md) turns the chunks of a
[`VoxelDocument`](../api/core/VoxelDocument.md) into Three.js meshes. This page
explains what the rendering features do and what they cost. The option
reference lives on the `VoxelView` page.

## Rebuilds

An edit marks its chunk dirty, plus the neighbouring chunks whose faces it can
hide or reveal, in every layer. `view.tick()` rebuilds dirty chunks within a
per-frame time budget, nearest to `view.focus` first. `view.flush()` rebuilds
everything now. Mesh workers move the rebuilds off the main thread.

## Chunk meshes

Each chunk cell gets one mesh per blockset and [surface](../api/blocks/BlockSurface.md)
(alpha mode, side, cutoff and material group), under `view.root`. Layers whose
position is a multiple of the chunk size share these meshes, so stacking
layers adds no draw calls; a layer moved off the chunk grid gets meshes of its
own. Faces touching a block of another
[blend group](../api/materials/BlendGroup.md) draw in a separate blended mesh.

Blockset ids must not contain `:surface=`; the view throws `RangeError` when it
builds meshes for such a blockset.

Opaque and masked surfaces write depth. Blended surfaces do not, and
overlapping ones need a
[`VoxelTransparencyPassNode`](../api/core/VoxelTransparencyPassNode.md).

## Material customizers

Chunk geometry does not carry ordinary vertex attributes: the vertex shader
rebuilds every face from compact per-face data. A `rendering.customizer`
therefore has to work with the materials as given:

- the geometry has no `uv` attribute, and its `position` and `normal`
  attributes do not hold positions or normals; do not read them;
- leave `positionNode` alone, since it is what rebuilds the faces;
- replacing `colorNode` drops tile sampling, ambient occlusion and distant
  tile filtering, and also changes what the shadow pass draws;
- the material's `map` is `null`, since the atlas is sampled by the color node.

Raycasts against chunk meshes work, but the hits carry no `uv`.

## View distance

`range.viewDistance` limits meshing to a radius of chunks around `focus`.
Chunks outside it are not meshed and keep their pending edits until they come
back in range. Built chunks that leave it are hidden or unloaded, depending on
`range.policy`. Colliders are not affected, so physics does not depend on the
camera. Frustum culling still applies on top. See
[`ViewDistance`](../api/world/ViewDistance.md) for the radius shapes.

## Tile minification

Atlases are sampled nearest-neighbour without mipmaps, since mipmaps would mix
neighbouring tiles. With `rendering.tileMinification: "average"`, the default,
a pixel that covers several texels shows their average instead of one of them,
which stops distant terrain from shimmering. The average stays inside the
face's own tile. Mask surfaces test the averaged coverage, so distant foliage
fills in. `"nearest"` turns the filter off.

The average needs the atlas pixels. When they cannot be read, such as a
cross-origin image without CORS, those faces fall back to nearest sampling.
The averages are recomputed on the next `tick()` after the atlas texture's
`version` changes, for example through `BlocksetAtlas.updateImage()`.

`rendering.alphaToCoverage` turns mask coverage into MSAA sample coverage for
softer cutout edges. It needs a multisampled render target and an opaque
canvas.

## Far distance

Past `range.farDistance` chunks from `focus`, a chunk draws each face in the
flat average colour of its tile and its blended blocks turn opaque. Only the
materials change, so crossing the threshold never remeshes a chunk. A chunk
switches back half a chunk inside the threshold, so one on the border does not
flicker. The default is `Infinity`.

## Normal maps

A blockset can come with a tangent-space normal atlas:

```ts
view.loadBlockset(definition, texture, { normal: normalTexture });
```

The normal atlas has the same layout and size as the colour atlas and uses the
OpenGL convention: red points right and green points up in the image. Rotated,
flipped and slanted faces need no extra data. The strength is the
[`normalScale`](../api/materials/MaterialGroup.md) of the block's material
group, `1` without a group; `normalScale: 0` turns it off. The relief fades out
in the distance and is absent past `farDistance`. Shadows ignore it. It works
with both `"lambert"` and `"standard"` materials; under `"standard"`, a low
roughness adds specular highlights on the relief.

## Ambient occlusion

`lighting.ambientOcclusion` darkens the creases between blocks, from `0` (off,
the default) to `1`, where a fully enclosed corner turns black. It is baked
into the chunk meshes, so it costs no post-processing pass, but it roughly
doubles chunk build time. Turning it on or off rebuilds every chunk; changing
the strength does not.

- A block casts occlusion only when it fully covers one of its faces, so
  cutout blocks and thin shapes such as poles cast none.
- Only faces on the cell boundary receive it: ramp slopes and the inner step of
  a stair stay lit.
- It multiplies the albedo, so it darkens direct and ambient light alike.
- An edit on a chunk edge or corner also rebuilds the diagonal chunks next to
  it.

## Block light

A block whose [material group](../api/materials/MaterialGroup.md) has a
`lightLevel` lights the blocks around it, Minecraft style: the light loses one
level per cell, so a level of 15 reaches 14 cells. It flows around opaque full
cubes and through every other block (slabs, stairs, glass, cutout leaves). The
colour follows the group's `emissive` hue, or white when `emissive` is black,
and each RGB channel spreads on its own, so two coloured lights mix. A
channel weaker than the peak starts at the level whose brightness matches its
share of the colour, so the hue holds near the source and the weak channels
fade out first.

`lighting.blockLight` scales the result, `1` by default and `0` to hide it.
The light adds to the scene lights rather than replacing them, so it shows
best in a dark scene. A standard material receives it like light from its
surroundings, so a metallic finish reflects it in its own colour instead of
going dark.

The material's `emissive` output holds only the glow of the emitting block,
not the light other blocks receive, so a bloom fed from it halos the light
sources alone. See [selective bloom](../api/core/VoxelTransparencyPassNode.md#selective-bloom).

- The light is computed on the CPU and never saved or sent to peers. An edit
  relights the chunks within reach of it; edits out of reach of any light cost
  nothing, and a world without glowing groups skips the work entirely. While
  `blockLight` is `0` the light is not updated; it catches up when the
  strength rises again.
- Each lit chunk mesh gets a small light texture (the chunk plus a one-cell
  border, about 23 KB for 16-cell chunks). A light change re-uploads that
  texture and does not rebuild the mesh.
- The vertex shader averages the light of the open cells around each corner,
  skipping opaque ones, so light fades smoothly across faces and does not leak
  through one-block walls. The texture stores light premultiplied by
  openness, so one filtered 3D sample does the whole average.
- Sun shadows do not dim it; ambient occlusion does, as it does every light.

`lighting.blockLightFalloff` picks the curve:

| Falloff | Next to the source | 3 cells away | 8 cells away |
| --- | --- | --- | --- |
| `"wide"` (default) | 0.82 | 0.57 | 0.23 |
| `"focused"` | 1.38 | 0.39 | 0.04 |

`"wide"` lights every cell in range almost evenly, Minecraft style.
`"focused"` is brighter near the source and fades fast, so a light reads as a
lamp with a pool of light around it. Values above 1 rely on tone mapping.
Changing the falloff rewrites the light texture of every lit chunk. Only
coloured lights are relit, because their channel levels depend on the curve.

A sun shadow still falls next to a glowing block, because block light adds to
the shadowed surface instead of replacing the missing sunlight.
`lighting.shadowFill` washes received shadows out where block light is
strong: `0` (default) keeps them whole, and at `1` a shadow vanishes where
block light reaches full brightness. Shadows far from any light keep their
strength.
