# Brush

How the local brush aims, shapes and writes. What peers see is in
[collaboration](./collaboration.md). The code will live in
`src/features/sculpt/`, `src/features/holes/` and `src/features/paint/`.

## Settings

Shared by every brush:

- `size`: radius in metres, 0.5 to 128. Ctrl+wheel resizes.
- `strength`: 0 to 1.
- `falloff`: a curve from the centre to the edge: `smooth` (default),
  `linear`, `sphere`, `sharp` or `constant`.
- `spacing`: distance between two stamps along a stroke, as a fraction of the
  radius. 0.25 by default.

Every change is saved in the browser and comes back after a reload.

## Aim

The mouse ray is cast against the terrain's heights, not its meshes, so it
hits the full-detail surface whatever LoD is drawn. Hole cells do not stop the
ray. With nothing hit, the brush has no target and hides.

## Pipeline

1. **Aim** gives the hit point and the surface normal.
2. **Stroke** places stamps along the mouse path, `spacing` apart.
3. **Apply** runs the brush on every sample under each stamp. The weight of a
   sample is `strength × falloff(distance / size)`, measured on X and Z.
4. **Patch batcher** collects the changed tiles. It sends the live patches
   every 100 ms and the commit when the stroke ends; see
   [strokes](./collaboration.md#strokes).

A stroke is one undo step. It writes the finest grid of each chunk under it,
so one stamp can span chunks of different tiers.

Brushes read heights through the document's world-space sampling, from a copy
taken before the stamp, so smooth and flatten see across chunk edges. A read
outside every chunk clamps to the nearest existing sample. Writes stay inside
existing chunks: until a commit can carry `chunk-added` with its patch, the part
of a stamp over empty ground is dropped. Written heights are clamped to
`[-4096, 4096]` m.

## Sculpt brushes

- **Raise and lower.** Left button raises, right button lowers, by
  `weight × strength` per stamp.
- **Smooth.** Moves each sample toward a Gaussian average of its neighbours.
- **Flatten.** Moves each sample toward a target height: the height under the
  press, or a fixed value set in the toolbar. Ctrl+click picks the target.
- **Ramp.** Drag from A to B. Samples within `size` of the segment move toward
  the line from A's height to B's, with the falloff across its width. Written
  on release, as one stroke.
- **Terrace.** Moves each sample toward the nearest multiple of a step
  height, set in the toolbar.

## Hole brush

Two modes: **cut** and **fill**. Ctrl inverts the mode while held. The brush
uses the same footprint, with no falloff: a quad is cut or filled when its
centre lies inside the radius. Heights under a hole are kept.

## Paint brush

Paints the selected layer into the splat map. For each texel, the weight
added is `weight × strength`; the four strongest layers are then kept and
renormalised to sum to 255. See [texture](./texture.md#splat).

## Previews

- The brush ring is drawn on the terrain at the hit point, in the falloff
  colour, with an inner ring where the falloff starts.
- Ramp draws its segment and its width while dragging.
- Peers' rings are drawn in their profile colour, inside the presence radius.
