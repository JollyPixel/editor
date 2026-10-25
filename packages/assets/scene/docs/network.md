# Scene network API

Syncs a [`SceneDocument`](./model.md) through a `scene:<assetId>` room. Browser code imports `@jolly-pixel/asset.scene/client`; asset-server code imports `@jolly-pixel/asset.scene/server`.

```ts
import { AssetRoom } from "@jolly-pixel/asset";
import {
  sceneDocumentKind,
  type SceneRoom
} from "@jolly-pixel/asset.scene/client";

const room: SceneRoom = client.room(new AssetRoom("scene", assetId).toString());
const synced = sceneDocumentKind().syncDocument(room);
room.join();
await synced.ready;

// On teardown: synced.dispose(); room.leave();
```

## Wire data

```ts
interface SceneSnapshot {
  environment: SceneEnvironmentJSON;
  actors: SceneActorJSON[]; // tree order
}

type SceneCommandAction =
  | "actor-added" | "actor-removed" | "actor-moved" | "actor-renamed"
  | "actor-visibility" | "actor-transformed"
  | "component-added" | "component-removed" | "component-moved"
  | "component-changed" | "component-assets-changed"
  | "environment-changed";
```

- The stored file adds a `version` to the snapshot. See the [asset](./asset.md) page for the actor and component shapes.
- `SceneNetworkCommand` is a `SceneCommand` plus the network command header.
- `sceneCommandProtocol` validates commands and `sceneSnapshotSchema` validates snapshots.

## Conflict keys

Last write wins per key, through a `KeyedCommandArbiter`, after the [tree rules](./model.md#tree-rules).

```ts
"actor-added"              // none
"actor-removed"            // every key of the subtree
"actor-moved"              // parent:<id>, transform:<id>:<field> for each field
"actor-renamed"            // name:<id>
"actor-visibility"         // visible:<id>
"actor-transformed"        // transform:<id>:<field> for each patched field
"component-added"          // components:<actorId>
"component-removed"        // components:<actorId>, every key of the component
"component-moved"          // components:<actorId>
"component-changed"        // component:<id>:<field> for each set or unset field
"component-assets-changed" // component-asset:<id>:<slot> for each slot
"environment-changed"      // environment:<field> for each patched field
```

- Two peers editing different fields of one component both keep their edit.
- A command loses a key only when it carries a `basis` older than the key's last write, as an undo does. A removal without a `basis` always wins.
- `sceneConflictKeys(command, erased)` returns the room's keys. `erased` holds the actors a removal erases, as `tree.erasedBy(command)` returns them: the removed subtree, or the owner of the removed component.
- With `erased` empty, a removal is keyed by the removed actor's own values only. The room does this when it restores recorded commands, since the removed actors are gone by then.
- `sceneWriteKeys(command)` returns the keys of a value write, and `null` for a command the client rebases.
