A `voxelmodel` is a small model built from blocks: boxes, planes, cylinders, cones and tori, each with a transform, a material and a UV net on the model's texture. Blocks and folders form a tree; a child block moves with its parent.

- Read it with `asset_read`: `nodes` (folders and blocks) and `materials`.
- Add materials with the `addMaterials` intent (`color`, `opacity`, `roughness`, `metalness`, `emissive`, `emissiveIntensity`), then blocks with `addBlocks`. Blocks name their material by name. A block's `position` is its centre, relative to its parent node, and rotation turns it around that point; `transform.size` is in voxels and y is up.
- A person moving a block or editing a material field holds a lock on it. Your edit of it then fails with the person's name: wait, or ask them in the chat.
- The model's texture is a `pixelart` asset created next to it: paint it with that asset's intents. `addBlocks` gives each new block its own net on the texture, growing the texture when it is full, and answers the net's `uv` rect: paint the block's faces inside it. A box net is 2 by 3 cells of 16 pixels, one cell per face; the block's `uv` in `asset_read` on the model says which face each cell holds.
- In a script, `golem.open(assetId, "voxelmodel")` returns a `VoxelModelAsset` with `addBlocks` and `addMaterials`, which take their intent's input, and `tree`.
