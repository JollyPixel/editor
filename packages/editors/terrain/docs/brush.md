# Brush

How the local brush aims, shapes and writes. What peers see is in
[collaboration](./collaboration.md). The code will live in
`src/features/sculpt/`, `src/features/holes/`, `src/features/paint/` and
`src/features/chunks/`.

## Settings

The toolbar picks one tool at a time: raise and lower, smooth, flatten, ramp,
terrace, paint, holes or chunks. The brushes share one ring and these
settings, except strength, which the sculpt tools share and paint keeps on its
own:

- `size`: radius in metres, 0.5 to 128. Ctrl+wheel resizes.
- `strength`: 0 to 1, for the sculpt tools; `paintStrength` for paint, 0.5
  by default.
- `falloff`: a curve from the centre to the edge: `smooth` (default),
  `linear`, `sphere`, `sharp` or `constant`.
- `spacing`: distance between two stamps along a stroke, as a fraction of the
  radius. 0.25 by default.

Every change is saved in the browser and comes back after a reload.

## Aim

The mouse ray is cast against the displayed heights, not the meshes, so it
hits the full-detail surface whatever LoD is drawn, on a refined chunk's own
grid, and along its edge with a coarser chunk the coarser grid, as drawn.
Hole cells do not stop the
ray, except with the hole tool: it hits the heights kept under a hole, so Fill
can aim at the opening. With nothing hit, the brush has no target and hides.

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
existing chunks: the part of a stamp over empty ground is dropped, and the
[Chunks tool](#chunks-tool) adds ground. Written heights are clamped to
`[-4096, 4096]` m.

## Sculpt brushes

- **Raise and lower.** Left button raises, right button lowers, at
  `weight × strength × size` metres per second.
- **Smooth.** Moves each sample toward a Gaussian average of its 3×3
  neighbours on its chunk's grid, 1 m, 0.5 m or 0.25 m apart, closing `weight × strength × 8` of the gap per second.
- **Flatten.** Moves each sample toward a target height at the same rate as
  smooth: the height under the press, or a fixed value set in the toolbar.
  With flatten selected, Ctrl+click switches to a fixed target and picks the
  height under the cursor, rounded to the centimetre. Both settings are saved
  with the others.
- **Ramp.** Drag from A to B. Samples within `size` of the segment move toward
  the line from the surface height under A to the height under B, by
  `weight × strength`, with the falloff across its width. The height under A
  is taken at the press, the one under B at release. Written once on release,
  as one stroke; a press released without moving writes nothing, and the
  right button does nothing.
- **Terrace.** Moves each sample toward a staircase of steps of a set height,
  set in the toolbar from 0.25 m to 256 m and 2 m by default, at the same
  rate as flatten. Within a step the staircase rises along a smooth curve; a
  sharpness setting, 0 to 100 % and 50 % by default, squeezes the rise
  toward the middle of the step, from soft steps at 0 to flat ledges at the
  nearest multiple of the step height at 100 %. Both settings are saved with
  the others.

## Hole brush

Two modes, picked in the toolbar: **cut** and **fill**. Ctrl inverts the mode
while held, so the tool has no Ctrl+click pick. The brush uses the same
footprint, with no strength and no falloff: a quad of the chunk's grid is cut
or filled when its centre lies inside the radius. Heights under a hole are
kept.

Holes reach peers and the saved asset as `holes-patched` commits on the
stroke commit cadence, as paint does; there are no live hole patches. A
stroke is one undo step. While the tool is selected, hole cells are drawn as in
the Holes overlay, over whichever overlay is on.

## Chunks tool

Works on whole chunks, in one of three modes:

- **Add.** A ghost outline shows the chunk under the cursor on empty ground,
  aimed at a plane at the mean height of its seeded edge, which the
  neighbours give. A click or a drag adds chunks next to existing ones, with
  their edges seeded from the neighbours.
- **Remove.** The ghost outlines the loaded chunk under the cursor. A click or
  a drag removes the chunks under it. Removing the last chunk is refused.
- **Detail.** Sets the chunks under a click or a drag to the tier picked in
  the toolbar, ×1, ×2 or ×4, saved with the other settings. The ghost
  outlines the loaded chunk under the cursor.

The ghost is grey where the click would be refused: a chunk that touches no
other, past the coordinate range or the chunk cap, the last one, or a chunk
already at the picked tier. Ctrl swaps Add and Remove for the next press,
and does nothing in Detail. A drag stays on a plane at the
height of its press and works on every chunk the cursor crosses, so a fast
drag leaves no gap. A drag is one undo step. Undoing an Add removes its
chunks, refused once a peer has edited one of them; undoing a Remove brings
back their heights, splat and holes. While the tool is selected, chunk
borders are drawn as in the Chunks overlay, over whichever overlay is on.

## Paint brush

Paints the material selected in the palette into the splat map; with no
material selected, a press does nothing. Each stamp moves every texel within
the radius toward the material by `falloff weight × strength`, the strength
growing with the time the brush is held, as smooth and flatten do: the
texel's weights are scaled down by that amount and the material's weight
gains it, so they keep summing to 255. A material not yet among a texel's
four takes the place of the weakest one, whose weight goes to the others.
See [texture](./texture.md#splat).

The painter sees each stamp at once. The paint reaches peers and the saved
asset as `splat-patched` commits on the stroke commit cadence: at its end,
every 2 s, and once 4 chunks are touched. Peers do not see the stroke before
its commits; there are no live paint patches yet. A stroke is one undo step.

Ctrl+click picks the material with the highest weight under the cursor and
selects it in the palette, as flatten picks a height.

## Previews

- The brush ring is drawn on the terrain at the hit point, with an inner ring
  where the falloff weight drops to one half. The constant falloff has no
  inner ring.
- Ramp draws its segment and its width while dragging.
- Peers' rings are drawn in their profile colour, inside the presence radius.
