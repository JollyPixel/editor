# Brush

How the local brush aims, shapes and writes. What peers see is in
[collaboration](./collaboration.md). The code will live in
`src/features/sculpt/`, `src/features/holes/` and `src/features/paint/`.

## Settings

The toolbar picks one tool at a time: raise and lower, smooth, flatten or
paint. They share one ring and these settings, except `strength`, which each
tool remembers:

- `size`: radius in metres, 0.5 to 128. Ctrl+wheel resizes.
- `strength`: 0 to 1, per tool.
- `falloff`: a curve from the centre to the edge: `smooth` (default),
  `linear`, `sphere`, `sharp` or `constant`.
- `spacing`: distance between two stamps along a stroke, as a fraction of the
  radius. 0.25 by default.

Every change is saved in the browser and comes back after a reload.

## Aim

The mouse ray is cast against the displayed heights, not the meshes, so it
hits the full-detail surface whatever LoD is drawn. Hole cells do not stop the
ray. With nothing hit, the brush has no target and hides.

## Pipeline

1. **Aim** gives the hit point and the surface normal.
2. **Stroke** places stamps along the mouse path, `spacing` apart, or one
   stamp under the cursor while it holds still. The brush keeps working for as
   long as the button is held.
3. **Apply** runs the brush on every sample under each stamp. The effect is a
   rate per second: each frame's share, up to 50 ms of it, is split between
   that frame's stamps, so dragging speed changes where the effect lands, not
   how much of it there is. The weight of a sample is
   `falloff(distance / size)`, measured on X and Z.
4. **Patch batcher** collects the changed tiles. It sends the live patches
   every 100 ms, and a commit every 2 s, once 4 chunks have been touched (at
   most every 250 ms), and when the stroke ends; see
   [strokes](./collaboration.md#strokes).

A stroke is one undo step. It writes the finest grid of each chunk under it,
so one stamp can span chunks of different tiers.

Brushes read `stroke.terrain`: the document with the stroke's own uncommitted
tiles over it, never a peer's live preview. They sample in world space from a copy taken
before the stamp, so smooth and flatten see across chunk edges. A read where
no chunk exists clamps to the nearest sample of a neighbouring chunk, and is 0
when no neighbour exists. Writes stay inside
existing chunks: until a commit can carry `chunk-added` with its patch, the part
of a stamp over empty ground is dropped. Written heights are clamped to
`[-4096, 4096]` m.

## Sculpt brushes

- **Raise and lower.** Left button raises, right button lowers, at
  `weight × strength × size` metres per second.
- **Smooth.** Moves each sample toward a Gaussian average of its 3×3
  neighbours, closing `weight × strength × 8` of the gap per second.
- **Flatten.** Moves each sample toward a target height at the same rate as
  smooth: the height under the press, or a fixed value set in the toolbar.
  With flatten selected, Ctrl+click switches to a fixed target and picks the
  height under the cursor, rounded to the centimetre. Both settings are saved
  with the others.
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
renormalised to sum to 255. A layer not yet among a texel's four takes the
place of the weakest one. See [texture](./texture.md#splat).

Ctrl+click picks the layer with the highest weight under the cursor, as
flatten picks a height.

## Previews

- The brush ring is drawn on the terrain at the hit point, with an inner ring
  where the falloff weight drops to one half. The constant falloff has no
  inner ring.
- Ramp draws its segment and its width while dragging.
- Peers' rings are drawn in their profile colour, inside the presence radius.
