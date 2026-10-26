# Texture

How the terrain surface is shaded: layers, the splat map that blends them, the
optional techniques per layer, and the debug overlays.

## Layers

A layer is a material that can be painted onto the terrain, such as grass,
rock or sand. It belongs to the terrain asset, travels in the manifest and
the join snapshot, and holds:

- an ID, its identity;
- a slot from 0 to 255, the value splat index texels hold;
- a name;
- references to [image assets](#images) in the catalog: albedo, and
  optionally normal and ORM (occlusion, roughness, metalness);
- a tiling scale, in metres per repeat;
- its technique flags (see below);
- `displacementScale`, 0 by default. Unused in V1; kept for
  [tessellation](./design.md#future-tessellation).

A terrain holds at most 32 layers in V1. The splat format allows 256, so the
cap can rise without a format change; it is there for GPU memory.

A slot is fixed for the life of its layer. Deleting a layer frees its slot
and leaves the splat as it is: the shader skips a slot with no layer and
renormalises the other weights of the texel. Undoing the delete brings the
paint back, and no chunk part is rewritten.

A new terrain starts with one layer in slot 0, named "Ground", with no image.
A layer without an albedo is drawn in a flat neutral colour. A missing normal
map reads as a flat normal, and a missing ORM as occlusion 1, roughness 1 and
metalness 0.

The view packs each map kind into a texture array, with one array layer per
terrain layer; a 256-entry slot table gives each slot its array layer, its
tiling and which maps it has. The arrays grow as layers are added. The
texture size is a terrain setting: 512, 1024 (default) or 2048, square. The
editor decodes each image at that size with `createImageBitmap`, and the view
copies it into its array layer on the GPU, so no pixels stay on the CPU.
Changing the setting rebuilds the arrays and uploads every image again. At
1024 with mipmaps, a layer costs about 17 MB of GPU memory across its three
maps.

### Images

Layer maps reference assets of the `texture` kind built into
`@jolly-pixel/asset-server`: image files stored as imported, with their own
extension. Every project registers it, so any image in a project is already a
`texture` asset, and other engine features can use the same assets.

A texture's room accepts no command. Its snapshot is the file content, so the
editor gets an image through the same join, reconnect and change
notifications as any asset; when the file changes, open terrains re-upload the
slices that use it. The editor decodes it with `createImageBitmap`, so a layer
accepts PNG, JPEG and WebP, at most 4096×4096, and shows an unsupported
format for the other extensions the kind claims (GIF, BMP, KTX2).

The image does not carry a colour space. The layer slot sets it: albedo is
sRGB, normal and ORM are linear, so one file can serve either.

The snapshot travels base64-encoded, about a third larger than the file. A
peer-to-peer session refuses messages over 16 MB, so it cannot send an image
much above 12 MB.

Slots hold a plain `AssetReferenceData`, so accepting `pixelart` assets later
needs no format change.

The terrain declares the images its layers reference as dependencies, so the
catalog keeps them and archives carry them.

### Layers panel

A side panel lists the layers with an albedo thumbnail, the splat overlay
swatch and the name. The selected layer is the one the paint brush writes.
Below the list, the selected layer's properties: the three image slots, picked
through the host's asset dialog, the tiling and the technique flags. The
terrain's texture size sits in the panel header.

## Splat

Each chunk has a splat map of 128×128 texels, 0.5 m each, made of two
`RGBA8` textures:

- **Indices**: the slots of the four strongest layers at that texel.
- **Weights**: their weights, summing to 255.

Each chunk's splat is its own asset part, beside its heights part, so a
sculpt checkpoint does not rewrite 128 KB of splat and painting does not
rewrite heights. A new chunk starts with slot 0 at weight 255 on every texel.

The fragment shader reads both, samples the four layers from the arrays and
blends them. The cost per pixel is fixed, whatever the number of layers in the
terrain. Slots with a weight of 0 are skipped.

Splat is stored per texel, not per vertex, so it does not change with the LoD.

### Why not vertex colours or RGBA masks

- **Vertex colours** tie paint resolution to mesh resolution. Coarse LoD
  levels drop vertices, and the paint on them.
- **RGBA masks** hold four layers per mask. Each further four layers add a
  mask and four samples per pixel.

## Techniques

Each layer can turn on:

- **Triplanar.** Projects the layer along X, Y and Z and blends by the normal,
  so cliffs do not stretch. A slope threshold limits it to steep surfaces.
- **Stochastic tiling.** Samples the layer with random offsets and rotations
  per cell and blends them, so a repeating texture shows no pattern.
- **Height blending.** Uses the albedo's alpha as a height, so layers blend
  along their relief, such as sand filling the gaps between stones, instead of
  a soft fade.

The shader branches per slot: a technique costs only where its layer is among
the four at that texel. Grass with stochastic tiling and rock with triplanar
only on cliffs pay for each technique only where they show.

## Overlays

View modes, drawn over the shaded terrain. They are local and never sent to
peers.

- **Slope.** A colour ramp by slope, from 0° to 60°, with faces steeper than
  the walkable angle, 45° by default, in red. Useful to see where a character
  cannot walk. See [slope overlay](./design.md#slope-overlay).
- **Splat.** Each slot has a fixed colour, shown as a swatch in the layers
  panel, and each texel blends the colours of its four slots by weight. The
  selected layer is highlighted. Shows what is painted where, whatever the
  images look like.
- **Chunk grid.** Chunk edges and coordinates.
- **LoD.** One colour per level.
- **Holes.** Hole cells, outlined, with the surface under them shown.
