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
hits the full-detail surface whatever LoD is drawn. Hole cells do not stop the
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
  neighbours, closing `weight × strength × 8` of the gap per second.
- **Flatten.** Moves each sample toward a target height at the same rate as
  smooth: the height under the press, or a fixed value set in the toolbar.
  With flatten selected, Ctrl+click switches to a fixed target and picks the
  height under the cursor, rounded to the centimetre. Both settings are saved
  with the others.
- **Ramp.** Drag from A to B. Samples within `size` of the segment move toward
  the line from the surface height under A to the height under B, by
  `weight × strength`, with the falloff across its width. Written once on
  release, as one stroke.
- **Terrace.** Moves each sample toward the nearest multiple of a step
  height, set in the toolbar and 2 m by default, at the same rate as flatten.
  A sharpness setting blends from soft steps to flat ledges.

## Hole brush

Two modes: **cut** and **fill**. Ctrl inverts the mode while held. The brush
uses the same footprint, with no falloff: a quad is cut or filled when its
centre lies inside the radius. Heights under a hole are kept.

Holes reach peers and the saved asset as `holes-patched` commits on the
stroke commit cadence, as paint does; there are no live hole patches. A
stroke is one undo step. The Holes overlay turns on while the tool is
selected.

## Chunks tool

Works on whole chunks, in one of three modes:

- **Add.** A ghost outline shows the chunk under the cursor on empty ground,
  aimed at a plane at the height of the nearest neighbour's edge, or 0. A
  click or a drag adds chunks next to existing ones, with their edges seeded
  from the neighbours.
- **Remove.** A click or a drag removes the chunks under it. Removing the last
  chunk is refused.
- **Detail.** Sets the chunks under a click or a drag to the tier picked in
  the toolbar, ×1, ×2 or ×4.

Ctrl swaps Add and Remove while held. A drag is one undo step. Undoing an Add
removes its chunks, refused once a peer has edited one of them; undoing a
Remove brings back their heights, splat and holes. The chunk grid overlay
turns on while the tool is selected.

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
