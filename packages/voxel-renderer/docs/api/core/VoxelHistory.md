# VoxelHistory

Undo/redo of voxel edits, exposed as `engine.history`. Disabled by default.

```ts
const engine = new VoxelEngine({
  layers: ["Ground"],
  history: { enabled: true, limit: 10 }
});

engine.world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: 1 });
engine.history.undo();
engine.history.redo();
```

## Options

```ts
interface VoxelHistoryOptions {
  /** @default false */
  enabled?: boolean;
  /**
   * Maximum number of undoable entries; the oldest is dropped first.
   * @default 10
   */
  limit?: number;
}
```

A `limit` that is not a positive integer throws a `RangeError`.

## What is recorded

Only local voxel edits made through [`VoxelWorld`](../world/VoxelWorld.md):
`setVoxel`, `removeVoxel`, `setVoxelBulk` and `removeVoxelBulk`. Layer,
object, block and tileset commands are not recorded. Silent writes are not
recorded either: the `*At` primitives, `engine.load()`, and commands replayed
with `apply()`, including those from peers.

Each call becomes one entry unless it happens inside `begin()` / `commit()`
or `world.transaction()`.
Cells an edit leaves unchanged are ignored, and an entry with no changed cell
is dropped. A new entry clears the redo stack.

## Replay

`undo()` and `redo()` write one `patchVoxels()` per layer inside a single
`world.transaction()`, so the world emits an ordinary `"voxels-patched"`
command per layer and the engine forwards them as local commands to network
adapters.

A cell is only reverted while it still holds the value the entry left there,
so an edit a peer made in between is kept. Cells on a layer that no longer
exists are skipped.

## Properties

```ts
class VoxelHistory extends Emitter<VoxelHistoryEvents> {
  readonly enabled: boolean;
  readonly limit: number;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}
```

## Methods

#### `begin(): void` / `commit(): void`

Groups every edit made in between into one entry, such as one brush stroke.
A cell edited several times keeps its first `before` and last `after`.
Calls nest; only the outermost `commit()` pushes the entry. `begin()` is a
no-op when the history is disabled.

#### `undo(): boolean` / `redo(): boolean`

Returns `false` when there is nothing to replay or a group is open.

#### `clear(): void`

Drops both stacks. `engine.load()` calls it.

#### `dispose(): void`

Detaches from the world and removes every listener. `engine.dispose()` calls
it.

## Events

```ts
type VoxelHistoryEvents = {
  change: (state: { canUndo: boolean; canRedo: boolean; }) => void;
};
```

Emitted after every push, undo, redo and non-empty clear.

```ts
engine.history.on("change", ({ canUndo, canRedo }) => {
  undoButton.disabled = !canUndo;
  redoButton.disabled = !canRedo;
});
```
