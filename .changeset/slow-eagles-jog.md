---
"@jolly-pixel/voxel.renderer": major
---

Migrate the network sync layer onto `@jolly-pixel/network`'s `NetworkPlugin`/`NetworkChannel` primitives, mirroring `@jolly-pixel/pixel-draw.renderer`'s design: `VoxelSyncServer` now extends `NetworkPlugin`, `VoxelTransport` matches `NetworkChannel`'s shape (`send`/single `onMessage`), and `VoxelSyncClient` is renamed to `VoxelSyncSession` with a two-step `attach(engine)`/`detach()` API that chains onto an existing `onLayerUpdated` handler instead of replacing it. `ConflictResolver`/`ConflictContext` are renamed to `VoxelConflictResolver`/`VoxelConflictContext`. `VoxelSnapshotRequest` and `VoxelTransport.requestSnapshot`/`sendCommand`/`onCommand`/`onSnapshot` are removed in favor of the new `VoxelServerMessage` envelope.
