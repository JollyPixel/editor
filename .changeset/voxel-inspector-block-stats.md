---
"@jolly-pixel/voxel.renderer": major
"@jolly-pixel/ui": minor
---

Rename `VoxelDebugger` to `VoxelInspector` (`engine.inspector`, `inspector` option); mesh counters move to `inspector.mesh.stats`.
Add block statistics: `inspector.blocks` (per layer, per block, unused, orphans, tileset usage) and `countBlocks()`/`countBlock()`/`voxelCount` on `VoxelWorld` and `VoxelLayer`.
Add `TreeNode.detail` to `jolly-tree` for a muted trailing row text.
