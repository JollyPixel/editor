## 💃 Getting Started

This workspace-private package stores `.scene.json` scenes: a tree of actors, each with an ordered list of components that can reference other assets. Add `"@jolly-pixel/asset.scene": "workspace:*"` to another workspace's dependencies.

## 👀 Usage example

```ts
import { AssetRoom } from "@jolly-pixel/asset";
import { Client } from "@jolly-pixel/network/client";
import {
  sceneDocumentKind,
  type SceneRoom
} from "@jolly-pixel/asset.scene/client";

const client = new Client();
const room: SceneRoom = client.room(new AssetRoom("scene", assetId).toString());
const synced = sceneDocumentKind().syncDocument(room);

room.join();
await synced.ready;
synced.document.addActor({ name: "Player" });

// On teardown: synced.dispose(); room.leave(); client.destroy();
```

## 📚 API

- `@jolly-pixel/asset.scene` exports the [asset kind](./docs/asset.md) (`sceneAssetKind`, `SceneState`, the file codec, `createSceneFile`, `SCENE_ASSET`, `ASSET_KINDS`) and the model the client entry point exports.
- `@jolly-pixel/asset.scene/client` exports the [scene document](./docs/model.md) (`SceneDocument`, `SceneTree`, `SceneTransform`, `sceneHistoryRegistration`), `sceneDocumentKind`, the [conflict keys](./docs/network.md) and the wire types.
- `@jolly-pixel/asset.scene/server` exports the conflict keys and the command and snapshot schemas.

The package root imports server dependencies, so browser code uses the client entry point. See [architecture](./ARCHITECTURE.md) for how the tree and the room fit together.

## ✨ Contributors guide

Read the [contributing guide](../../../CONTRIBUTING.md) before submitting a change. Run `pnpm --filter @jolly-pixel/asset.scene test` and `pnpm run lint` from the monorepo root.

## 📃 License

MIT
