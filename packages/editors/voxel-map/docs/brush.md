# Brush

How the local brush aims, sizes and paints. Peers and presence are out of
scope. The code lives in `src/features/painting/`.

## Settings

- `size`: 1 to 16, default 1. Keys `[` and `]`, or Ctrl+wheel.
- `mode`: `build` (default) or `replace`. Key `R`.
- `pattern`: `square` (default) or `circle`. Key `C`.
- `rotationMode`: `auto` (default) or a fixed 0/90/180/270.
- `flipY`: places blocks upside down. Off by default.
- `ghost`: block preview, size 1 only. Key `G`.
- `skyRadius`: 24 by default, 0 turns sky aiming off. Console only.

All of them are under the `brush.` console namespace. The keys work only while
a voxel layer is selected.

## Input

- Left button paints with the current mode, Build or Replace.
- Right button erases, whatever the mode.
- Ctrl+left click picks a block. Ctrl+wheel resizes. Holding Ctrl never paints.
- The brush hides and stops while Alt or the middle button is held, while the
  cursor is off the canvas, while an object layer is selected, while a
  template or layer is being placed, and while another tool holds the pointer.
- With no voxel layer selected, a click shows the "blocked" notice instead.

## Aim

Each frame the mouse ray gives two cells: **remove**, the cell a right click
targets, and **place**, the cell a left click builds in. The ray reaches 32
voxels.

- **Block hit:** remove is the hit block. Place is the empty neighbour on the
  face the ray entered through.
- **Ground hit:** the ground is the y=0 plane, and it counts only when the ray
  hits no block. Place and remove are the same cell, at y=0.
- **Sky:** nothing hit within 32 voxels. Place and remove are the same cell,
  where the ray crosses a sphere of `skyRadius` voxels around the camera. With
  `skyRadius` at 0 the brush has no target.
- **Merge:** in Build mode, when the hit cell holds a single shape that the
  selected block (in its current orientation) completes, place becomes the hit
  cell.

## Footprint

The footprint is the set of cells the brush covers around its target cell: a
flat N×N square, or a disc with `circle`, one layer thick at the target's
height. It is centred on the target along X and Z. With an even size the extra
cell goes on the negative side.

On a side face the Build footprint is centred on the neighbour cell, so above
size 1 it can reach back into the hit block's row. Build skips occupied cells,
so the hit block is left alone.

## Click

A press starts a stroke and paints the footprint once:

- Build: around the place cell. Fills empty cells and completes half shapes.
- Replace: around the remove cell. Repaints occupied cells that differ from
  the selected block. Never fills empty cells.
- Erase: around the remove cell. Deletes occupied cells.

Only the selected layer is written, but the ray hits blocks on every layer.

## Drag

Erase never drags: a right click erases once, and moving the mouse before the
release does nothing more.

A Build or Replace stroke stays active until the left button is released. It
freezes the pattern, mode and block orientation at press time. Size is read
live.

Until the pointer has moved 4 pixels from the press, the stroke stays on the
start cell and paints nothing more, so a click that shakes the mouse places one
footprint. Past that distance, each frame the brush moves to the first of
these that applies:

1. The ray crosses a cell this stroke already covered: the brush moves to it.
   It paints there in Replace. In Build it paints only when the pointer comes
   back onto an older cell, outside the latest footprint: one footprint goes
   on the neighbour across the face the ray entered through, top and bottom
   faces included, with no line joined from the last position.
2. The ray hits a block or the ground: the cell a click would paint, place in
   Build and remove in Replace. The stroke climbs and descends with the
   surface.
3. Otherwise: where the ray crosses the height of the last painted cell,
   within 32 voxels.

Moving the mouse fast stamps the footprint along a straight line of cells from
the last position. When the height changes, the line runs at the lower of the
two heights and its last cell is lifted onto the target, so climbing a step
never leaves floating blocks. Each cell is written at most once per stroke. A stroke is one undo
step, labelled Paint or Replace. An erase click is one step, labelled Erase.

## Size 1 only

- A cell holding two merged shapes can be targeted one shape at a time: Erase
  removes the aimed shape, Replace repaints it, Ctrl+click picks it.
- In Build mode, a red overlay shows the shape a right click would remove. It
  also shows while Ctrl is held.
- In a drag, only the start cell is split this way. Every other cell is
  treated as a whole.
- The ghost block works only at this size.

## Pick

Ctrl+click picks the aimed shape at size 1. Otherwise it picks the first block
found in the remove footprint, starting from its centre, on any layer.

## Preview

- Idle: the outline shows the remove footprint, in Build mode too. The aimed
  face of the single hit cell is highlighted.
- Dragging: the outline follows the stroke and the face highlight is hidden.
- Ghost on, idle: in Build mode the block appears in the place cell when that
  cell is empty or can merge. In Replace mode it appears over the remove cell
  when that cell is occupied, as the new shape when the cell holds two.
- Ghost on, dragging: the block follows the stroke.
- While the ghost shows, the outline is hidden and the face highlight stays.
  While the red overlay shows, both are hidden.

## Orientation

With `rotationMode` set to `auto`, the rotation follows the camera's horizontal
look direction, snapped to the nearest quarter turn, and `flipY` is forced on
while the camera looks upward. With a fixed rotation, the rotation and `flipY`
settings apply as set.

## Surprises

- In Build mode the outline shows the cell you would erase. Only the ghost
  shows where a left click builds.
- On the ground, Build and Erase target the same cell. On a block they target
  different cells.
- On a side face, a Build footprint above size 1 is centred on the neighbour
  cell, so part of it falls in the hit block's row, where occupied cells are
  skipped.
- Past 32 voxels the ground is ignored and the brush aims into the sky sphere,
  24 voxels away by default.
- A Build drag that crosses a block's side face paints in front of that face,
  at the face's height, as a click would.
- A Build drag over its latest footprint moves the brush without painting,
  since each new block lands under the pointer. To grow a line toward the
  camera, move onto an older block of the stroke and back onto the new one.
- Going back over blocks painted earlier in the same stroke builds on them.
  Sweeping across a row's top faces stacks a layer on it, and this happens
  with a floor too.
