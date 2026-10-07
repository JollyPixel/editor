<h1 align="center">
  asset.voxel-animation
</h1>

<p align="center">
  Voxel animation set assets
</p>

## 💃 Getting Started

This workspace-private package stores `.voxelanim.json` animation sets: clips of keyframes that target blocks by name path, so one set can play on every model sharing a hierarchy (a "Humanoid" rig, say). Add `"@jolly-pixel/asset.voxel-animation": "workspace:*"` to another workspace's dependencies. Models link sets through `@jolly-pixel/asset.voxel-model`, which binds the tracks to their blocks.

## 👀 Usage example

### Register the kind

```ts
import { voxelAnimationAssetKind } from "@jolly-pixel/asset.voxel-animation";
import { createAssetWorkspacePlugin } from "@jolly-pixel/asset-server/node";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    createAssetWorkspacePlugin({
      root: import.meta.dirname,
      handlers: [voxelAnimationAssetKind()]
    })
  ]
});
```

A set created without content is empty: `createVoxelAnimationDocument()`, version 1, no rig label and no clip. `decodeVoxelAnimationDocument()` throws `InvalidAssetDocumentError` from `@jolly-pixel/asset-server` when the bytes are not JSON or do not match `voxelAnimationDocumentSchema`; loading then throws `InvalidAnimationSetError` for a repeated clip, a repeated track path, keys out of tick order or a frame rate off the tick grid, and keeps the previous set.

### Connect a set

```ts
import { assetRoomName } from "@jolly-pixel/asset";
import { Client } from "@jolly-pixel/network/client";
import {
  frameToTick,
  SyncedAnimationDocument,
  type AnimationRoom
} from "@jolly-pixel/asset.voxel-animation/client";

const client = new Client();
const room: AnimationRoom = client.room(assetRoomName("voxelanimation", assetId));
const synced = new SyncedAnimationDocument(room);

room.join();
await synced.ready;
const walk = synced.document.addClip({ name: "Walk" });
synced.document.setKey(walk!, "Body/Arm.L", "rotation", {
  tick: frameToTick(12, 24),
  value: { x: 45, y: 0, z: 0 },
  interpolation: "smooth"
});

// On teardown: synced.dispose(); room.leave(); client.destroy();
```

## 📚 API

- `@jolly-pixel/asset.voxel-animation` exports `voxelAnimationAssetKind`, the document codec and `voxelAnimationDocumentSchema`, `AnimationSet`, `AnimationDocument`, sampling and tick helpers, the `VOXEL_ANIMATION_ASSET` descriptor, `ASSET_KINDS` (the [kind package](../../asset-server/docs/AssetKinds.md#kind-packages), taking `{ snapshot? }` options), and the kind and event constants.
- `@jolly-pixel/asset.voxel-animation/client` exports `SyncedAnimationDocument`, `animationHistoryKeys`, `animationWriteKeys`, `voxelAnimationDocumentKind`, the model, and the types.
- `@jolly-pixel/asset.voxel-animation/server` exports `AnimationCommandArbiter`, the command and snapshot schemas, and the conflict keys.

The package root imports server dependencies. Browser code should use the client entry point. See the [network API](./docs/network.md) for the data model, commands and sync behavior.

## ✨ Contributors guide

Read the [contributing guide](../../../CONTRIBUTING.md) before submitting a change. Run `pnpm --filter @jolly-pixel/asset.voxel-animation test` and `pnpm run lint` from the monorepo root.
