# Texture

How the terrain surface is shaded: materials, the splat map that blends them,
the optional techniques per material, and the debug overlays.

## Materials

A material is a surface that can be painted onto the terrain, such as grass,
rock or sand. It belongs to the terrain asset, travels in the manifest and
the join snapshot, and holds:

- an ID, its identity;
- a slot from 0 to 255, the value splat index texels hold;
- a name;
- references to [image assets](#images) in the catalog, one per map, each
  optional: albedo, normal, ORM (occlusion, roughness, metalness) and height;
- a tiling scale, in metres per repeat;
- its technique flags (see below);
- `displacementScale`, 0 by default. Unused in V1; kept for
  [tessellation](./design.md#future-tessellation), which will displace by the
  height map.

A terrain holds at most 32 materials in V1. The splat format allows 256, so
the cap can rise without a format change; it is there for GPU memory.

A slot is fixed for the life of its material. Deleting a material frees its
slot and leaves the splat as it is: the shader skips a slot with no material
and renormalises the other weights of the texel. Undoing the delete brings the
paint back, and no chunk part is rewritten.

A new terrain starts with one material in slot 0, named "Ground", with no
image. A material without an albedo is drawn in a flat neutral colour. A
missing normal map reads as a flat normal, a missing ORM as occlusion 1,
roughness 1 and metalness 0, and a missing height map as flat.

The view packs each map kind into a texture array, with one array layer per
material; a 256-entry slot table gives each slot its array layer, its tiling
and which maps it has. The arrays grow as materials are added. The texture
size is a terrain setting: 512, 1024 (default) or 2048, square. The editor
decodes each image at that size with `createImageBitmap`, and the view copies
it into its array layer on the GPU, so no pixels stay on the CPU. Changing the
setting rebuilds the arrays and uploads every image again. At 1024 with
mipmaps, a material costs about 22 MB of GPU memory across its four maps.

### Images

Material maps reference assets of the `texture` kind built into
`@jolly-pixel/asset-server`: image files stored as imported, with their own
extension. Every project registers it, so any image in a project is already a
`texture` asset, and other engine features can use the same assets.

A texture's room accepts no command. Its snapshot is the file content, so the
editor gets an image through the same join, reconnect and change
notifications as any asset; when the file changes, open terrains re-upload the
slices that use it. The editor decodes it with `createImageBitmap`, so a
material accepts PNG, JPEG and WebP, at most 4096×4096, and shows an
unsupported format for the other extensions the kind claims (GIF, BMP, KTX2).

The image does not carry a colour space. The map it fills sets it: albedo is
sRGB, normal, ORM and height are linear, so one file can serve either.

The snapshot travels base64-encoded, about a third larger than the file. A
peer-to-peer session refuses messages over 16 MB, so it cannot send an image
much above 12 MB.

Maps hold a plain `AssetReferenceData`, so accepting `pixelart` assets later
needs no format change.

The terrain declares the images its materials reference as dependencies, so
the catalog keeps them and archives carry them.

### Material palette

The Materials pane starts in the right dock; it can be dragged to the left
dock or floated, and each person's layout is kept. It shows the terrain's
materials as square swatches, each drawn from its albedo, or in the fallback
colour without one, with a badge per map it has: A, N, O and H. It shows only
the materials loaded for this terrain, not every texture in the project.
Clicking a swatch selects it; the selected material is the one the paint
brush writes. The selection is each person's own: it is not shared and not
undone. Removing the selected material selects the first one left.

Adding a material starts from an image:

- **+** opens the host's asset dialog on `texture` assets. The picked image
  fills the map its name ends with, or the albedo, and the images in the same
  folder named after the same material fill the other maps.
- Image files dropped on the pane from the desktop are imported into a
  `textures` folder beside the terrain, then grouped by name: `rock_albedo`,
  `rock_normal` and `rock_height` make one material, Rock; an image whose name
  ends with no map word, such as `grass.png`, makes a material with it as the
  albedo.
- When a dropped image's path already holds a texture, the pane asks once per
  drop: **Replace** writes the new content into the existing texture, keeping
  its ID, so every terrain using it repaints for everyone, and a material
  already using those textures is selected instead of added; **Keep both**
  imports a copy with a numbered name. The asset's restore point brings the
  old content back.

Map words are matched case-insensitively at the end of the name, after `_`,
`-`, `.` or a space: albedo, basecolor, diffuse, color for the albedo;
normal, nrm for the normal; orm, arm for the ORM; height, displacement, disp
for the height.

Below the grid, the selected material shows the essentials first: a preview,
its name and a Scale field, the metres one repeat covers. Two folded sections
hold the rest, worded for people new to materials, with the technical name in
each tooltip:

- **Maps**: Color (albedo), Bumps (normal), Surface (ORM) and Height. Each map
  can be picked, replaced by a dropped image, or cleared.
- **Look**: Wrap steep slopes (triplanar), Hide repetition (stochastic
  tiling) and Blend by height (height blending).

The terrain's texture size sits above the grid. Every change goes through the
terrain's undo history.

## Splat

Each chunk has a splat map of 128×128 texels, 0.5 m each, made of two
`RGBA8` textures:

- **Indices**: the slots of the four strongest materials at that texel.
- **Weights**: their weights, summing to 255.

Each chunk's splat is its own asset part, beside its heights part, so a
sculpt checkpoint does not rewrite 128 KB of splat and painting does not
rewrite heights. A new chunk starts with slot 0 at weight 255 on every texel.

Paint travels as `splat-patched` commits of 32×32-texel tiles, 16 m on a side
like the height tiles, so a tile index means the same ground for both. A
tile's texels must each weigh 255 in total, or the tile is refused and the
author gets the tile's current splat back. Undoing a chunk's removal brings
its paint back.

The overview keeps, for each 32 m point, the material with the highest weight
in the texel there. The asset file and the room snapshot list them per
chunk, so a far peer colours its horizon without loading the chunk, and
members that have not subscribed to a painted chunk receive only the tiles
that hold those points.

The fragment shader takes the four materials of the texel under the pixel,
samples them from the arrays and blends them by weight: albedo, normal detail
and ORM alike. Each material's weight is interpolated bilinearly from the four
texels around the pixel, so a fade drawn over several texels stays smooth
instead of showing 0.5 m squares. The cost per pixel is fixed, whatever the
number of materials in the terrain; a slot whose material was deleted adds
nothing, and the other weights are renormalised. The texel that picks the four
materials is offset by smooth world-space noise, so where the set of materials
changes, the edge reads as a wavy line instead of the texel grid. A pixel on
an unloaded chunk draws the dominant material of the nearest 32 m overview
point.

Splat is stored per texel, not per vertex, so it does not change with the LoD.

### Why not vertex colours or RGBA masks

- **Vertex colours** tie paint resolution to mesh resolution. Coarse LoD
  levels drop vertices, and the paint on them.
- **RGBA masks** hold four materials per mask. Each further four materials
  add a mask and four samples per pixel.

## Techniques

Each material can turn on:

- **Triplanar.** Projects the material along X, Y and Z and blends by the
  normal, so cliffs do not stretch. It starts on slopes steeper than about
  18°; flatter ground keeps the single top-down projection. Normal maps are
  blended per projection with a whiteout blend.
- **Stochastic tiling.** Splits each repeat into a triangle grid, about three
  cells per repeat, and samples the material at a random offset per cell,
  blending the three cells around the pixel. A repeating texture then shows
  no pattern. Cells are offset, not rotated, so normal maps stay correct.
- **Height blending.** Raises each material's weight by its height map and
  keeps only what lies within 0.2 of the highest, so materials meet along
  their relief, such as sand filling the gaps between stones, instead of a
  soft fade. It applies to a texel when one of its materials uses it and has
  a height map; the others count as flat ground at mid height.

The shader branches per slot: a slot with no weight at a texel samples
nothing, and a technique costs only where its material is among the four at
that texel. Grass with stochastic tiling and rock with triplanar pay for each
technique only where they show. Triplanar with stochastic tiling is the
dearest: nine samples per map.

## Overlays

View modes, drawn over the shaded terrain. They are local and never sent to
peers.

- **Slope.** A colour ramp by slope, from 0° to 60°, with faces steeper than
  the walkable angle, 45° by default, in red. Useful to see where a character
  cannot walk. See [slope overlay](./design.md#slope-overlay).
- **Splat**, "Painted materials" in the toolbar. Each slot has a fixed
  colour, picked by the golden ratio so neighbouring slots differ, and shown
  as a dot on its swatch while the overlay is on. Each texel blends the
  colours of its four slots by weight, before height blending. Texels darken
  to 30% as the selected material's weight falls, so its paint stands out.
  Shows what is painted where, whatever the images look like.
- **Chunk grid.** Chunk edges and coordinates.
- **LoD.** One colour per level.
- **Holes.** Hole cells, outlined, with the surface under them shown.
