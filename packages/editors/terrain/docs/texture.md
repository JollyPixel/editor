# Texture

How the terrain surface is shaded: layers, the splat map that blends them, the
optional techniques per layer, and the debug overlays.

## Layers

A layer is a material that can be painted onto the terrain. It belongs to the
terrain asset and holds:

- a name;
- references to image assets in the catalog: albedo, and optionally normal and
  ORM (occlusion, roughness, metalness);
- a tiling scale, in metres per repeat;
- its technique flags (see below);
- `displacementScale`, 0 by default. Unused in V1; kept for
  [tessellation](./design.md#future-tessellation).

At load, the view packs each map kind into a `Texture2DArray`, one slice per
layer. All images of a kind are resized to the same size. Up to 256 layers.

## Splat

Each chunk has a splat map of 128×128 texels, 0.5 m each, made of two
`RGBA8` textures:

- **Indices**: the four strongest layers at that texel.
- **Weights**: their weights, summing to 255.

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

- **Slope.** Faces steeper than a threshold angle, 45° by default, are tinted
  red. Useful to see where a character cannot walk.
- **Chunk grid.** Chunk edges and coordinates.
- **LoD.** One colour per level.
- **Holes.** Hole cells, outlined, with the surface under them shown.
