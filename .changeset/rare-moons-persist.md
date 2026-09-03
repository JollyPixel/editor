---
"@jolly-pixel/voxel.renderer": minor
---

Synchronize and persist block definitions: `onBlockUpdated` hooks published by
`VoxelSyncClient` keep Block Library edits across restarts, and
`VoxelSyncServer` now throws on invalid commands instead of logging them.
