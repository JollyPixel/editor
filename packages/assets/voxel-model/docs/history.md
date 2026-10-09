# Voxel-model history

`ModelDocument` is a [`CommandDocument`](../../../history/docs/CommandDocument.md) from `@jolly-pixel/history`, so it can be registered in a [`CommandHistory`](../../../history/docs/CommandHistory.md) directly. `modelHistoryKeys(tree)` returns the keys that registration needs. Everything below is exported from `@jolly-pixel/asset.voxel-model/client`.

```ts
import { CommandHistory } from "@jolly-pixel/history";
import {
  ModelDocument,
  modelHistoryKeys
} from "@jolly-pixel/asset.voxel-model/client";

const document = new ModelDocument();
const history = new CommandHistory<"build">();
history.register({
  id: "model",
  document,
  keys: modelHistoryKeys(document.tree),
  scopeOf: () => "build"
});

const step = history.open("build", "Add body");
document.addBlock({ name: "Body" });
step.commit();

history.undo("build");
```

Register `synced.document` when the model is synced: the sync client fills its `receipts`, so the history can refuse steps a peer overwrote and send undos the server can refuse.

## What is recorded

Every local edit of nodes, materials and animation set links. A change carries the commands that undo it (`inverse`) and an `image` of what it replaced: the entries as they were before it, grouped as `{ nodes, materials, animationSets }`, with the ID order of each group. For a node removal, `image.before.nodes` is the whole subtree it took.

Not recorded: commands applied with `apply()` (peer commands) or `replayPending()`, and snapshots loaded with `load()`, which emits `reset`.

## Steps and refusals

- A step guards the values its undo would write back, per conflict key, plus the subtree of an entry whose creation it undoes.
- A peer write to a guarded value refuses the step. A peer editing another value of the same entry leaves it undoable.
- A reload that leaves a guarded value different refuses it too.
- An undo is sent with the `basis` of the step, the room version it replays. The server refuses it when a peer wrote a newer value since. See [architecture](../ARCHITECTURE.md#collision-keys).
- A re-added or moved entry whose former next sibling is gone lands last.

## API

```ts
type ModelChange = CommandChange<VoxelModelCommand, ModelImage>;

interface ModelImage {
  before: ModelImages;
  order: EntryOrder;
}

function modelHistoryKeys(tree: ModelTreeReader): HistoryKeys<VoxelModelCommand, ModelImage>;
```

`modelHistoryKeys()` writes the [conflict keys](../ARCHITECTURE.md#collision-keys) of each change, plus `subtree:<id>` and `material-subtree:<id>` for a change inside a node or a material folder.
