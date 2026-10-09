# Voxel-animation history

`AnimationDocument` is a [`CommandDocument`](../../../history/docs/CommandDocument.md) from `@jolly-pixel/history`, so it can be registered in a [`CommandHistory`](../../../history/docs/CommandHistory.md) directly. `animationHistoryKeys(set)` returns the keys that registration needs. Everything below is exported from `@jolly-pixel/asset.voxel-animation/client`.

```ts
import { CommandHistory } from "@jolly-pixel/history";
import {
  AnimationDocument,
  animationHistoryKeys
} from "@jolly-pixel/asset.voxel-animation/client";

const document = new AnimationDocument();
const history = new CommandHistory<"animate">();
history.register({
  id: "set",
  document,
  keys: animationHistoryKeys(document.set),
  scopeOf: () => "animate"
});

const step = history.open("animate", "Add walk");
document.addClip({ name: "Walk" });
step.commit();

history.undo("animate");
```

Register `synced.document` when the set is synced: the sync client fills its `receipts`, so the history can refuse steps a peer overwrote and send undos the server can refuse.

## What is recorded

Every local edit of the rig, clips, tracks and keys. A change carries the commands that undo it (`inverse`) and an `image` of what it touched, as it was before.

Not recorded: commands applied with `apply()` (peer commands) or `replayPending()`, and snapshots loaded with `load()`, which emits `reset`.

## Steps and refusals

- A step guards the values its undo would write back, per conflict key. Undoing a clip's creation also guards the clip's tracks.
- A peer write to a guarded value refuses the step.
- An undo is sent with the `basis` of the step, the room version it replays. The server refuses it when a peer wrote a newer value since. See [architecture](../ARCHITECTURE.md#collision-keys).
- A re-added or moved clip whose former next clip is gone lands last.

## API

```ts
type AnimationChange = CommandChange<AnimationCommand, AnimationImage>;

function animationHistoryKeys(set: AnimationSetReader): HistoryKeys<AnimationCommand, AnimationImage>;
```

`animationHistoryKeys()` writes the [conflict keys](../ARCHITECTURE.md#collision-keys) of each change, plus `clip-content:<id>` for any key or track change in the clip.
