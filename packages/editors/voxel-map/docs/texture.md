# Texture

How UV edits in the blockset texture panel reach the blocks. The code lives in
`src/features/texture/`.

## UV sync

Each textured block on the active blockset has a UV region in the panel.
Moving, resizing, rotating or restacking that region redefines the block, which
re-meshes the map and sends a `block-defined` command to every peer.

`texture.uvSync` decides when a drag does that:

- `commit` (default): the block is redefined once, when the region is dropped.
  A cancelled drag (Escape) writes nothing.
- `live`: the block follows the drag, redefined at most once per animation
  frame, and the drop writes the final rect if the last frame did not. Peers
  re-mesh on every frame too, so this mode costs the most on large maps.

In both modes, peers see a drag outline of the moving region on their texture
panel. The value is saved in the browser under `voxel-map:uv-sync`.

## Blockset tabs

Each blockset has a tab above the panel. Double click a tab, or press F2 on the
focused tab, to edit its blockset. Unlinked blocksets keep a disabled tab that
still opens the editor.

`texture.tabs` is `tabs` (default) or `line`. `line` draws the strip as a thin
bar of segments that show the blockset name and tile size on hover. The toggle
at the top of the panel's left rail switches the same value, saved in the
browser under `voxel-map:texture-tabs`.
