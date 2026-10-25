# Scene asset

The `scene` kind stores a tree of actors as `.scene.json`. Everything below is exported from `@jolly-pixel/asset.scene`.

```ts
import {
  createSceneFile,
  encodeSceneFile,
  sceneAssetKind
} from "@jolly-pixel/asset.scene";
import { createAssetServerPlugin } from "@jolly-pixel/asset-server/node";

createAssetServerPlugin({
  root: import.meta.dirname,
  handlers: [sceneAssetKind()],
  seed: {
    "scenes/level.scene.json": () => encodeSceneFile(createSceneFile())
  }
});
```

## File

```ts
interface SceneFile {
  version: 1;
  environment: SceneEnvironmentJSON;
  actors: SceneActorJSON[]; // tree order
}

interface SceneActorJSON {
  id: string;
  name: string;
  parentId: string | null;
  visible: boolean;
  transform: SceneTransformJSON; // rotation in degrees
  components: SceneComponentJSON[];
  prefab?: AssetReferenceJSON; // reserved, refused
}

interface SceneComponentJSON {
  id: string;
  type: string;
  data: JSONObject;
  assets: Record<string, AssetReferenceJSON | null>;
}

interface SceneEnvironmentJSON {
  background: string | null; // "#rrggbb"
  environment: { kind: "none" | "room"; intensity: number; };
  fog:
    | { kind: "none"; }
    | { kind: "linear"; color: string; near: number; far: number; }
    | { kind: "exp2"; color: string; density: number; };
}
```

- `SceneFile` is the engine's `Systems.SceneFile`; a type test keeps the two assignable both ways.
- An actor follows its parent in `actors`, and siblings follow their display order.
- Actor ids are unique in the file, and so are component ids.
- The kind never reads `type` or `data`, so a component type it does not know round-trips untouched.
- `JSON.stringify(data)` of one component stays within `COMPONENT_DATA_MAX_LENGTH` characters (65 536).

## Functions

### createSceneFile(): SceneFile

A new scene: "Main Camera" (a perspective `Camera` at `(0, 2, 6)` facing the origin), "Sun" (a directional `Light` with shadows) and "Sky" (a hemisphere `Light`). A scene created without content starts from it.

### encodeSceneFile(file): Uint8Array

The stored form, `compactSceneFileSchema`: a transform field equal to the identity and `visible: true` are left out.

### decodeSceneFile(content): SceneFile

Fills the left-out fields back in. Throws `InvalidAssetFileError` when the bytes are not JSON or do not match `compactSceneFileSchema`.

### sceneAssetKind(options?): AssetKindHandler

The kind handler. `options.snapshot` changes when snapshots are written. Loading throws `InvalidAssetFileError` when the tree breaks a rule above or holds a `prefab`.

## SceneState

The server state behind the handler.

```ts
class SceneState {
  conflictKeys(command: SceneCommand): string[];
  dependencies(): AssetReferenceData[];
  rebind(idMap: ReadonlyMap<string, string>): void;
  snapshot(): SceneSnapshot;
  toJSON(): SceneFile;
}
```

- `conflictKeys()` returns the room's [conflict keys](./network.md#conflict-keys) for `command` against the current tree.
- `dependencies()` lists every filled `assets` slot and every `prefab`, each reference once.
- `rebind()` rewrites those references through `idMap`.
