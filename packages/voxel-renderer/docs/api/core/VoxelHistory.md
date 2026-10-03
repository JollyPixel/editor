# VoxelHistory

Undo/redo of voxel edits, exposed as
[`document.history`](./VoxelDocument.md#properties). Disabled by default.

```ts
const document = new VoxelDocument({
  layers: ["Ground"],
  history: { enabled: true, limit: 10 }
});

document.world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: 1 });
document.history.undo();
document.history.redo();
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `false` | |
| `limit` | `number` | `10` | Maximum undoable entries; the oldest is dropped first. A value that is not a positive integer throws a `RangeError`. |

## What is recorded

Local `setVoxel`, `removeVoxel`, `setVoxelBulk`, `removeVoxelBulk`,
`patchVoxels` and `transformLayer` calls on
[`VoxelWorld`](../world/VoxelWorld.md). Not recorded: layer, object, block and
tileset commands, direct `VoxelLayer` writes, `document.load()`, and commands
replayed with `apply()`, including those from peers.

Each call is one entry, unless it runs inside `begin()`/`commit()` or
`world.transaction()`. An entry that changed no cell is dropped. A new entry
clears the redo stack.

Undo and redo emit local `"voxels-patched"` commands, so peers receive them. A
cell a peer changed since the edit is left alone, and cells on a removed layer
are skipped.

## Properties

```ts
readonly enabled: boolean;
readonly limit: number;
readonly canUndo: boolean;
readonly canRedo: boolean;
```

## Methods

#### `begin(): void` / `commit(): void`

Groups the edits made in between into one entry, such as one brush stroke.
Calls nest; only the outermost `commit()` pushes the entry. `begin()` does
nothing while the history is disabled.

#### `undo(): boolean` / `redo(): boolean`

Returns `false` when there is nothing to replay or a group is open.

#### `clear(): void`

Drops both stacks. `document.load()` calls it.

#### `dispose(): void`

Detaches from the world and removes every listener. `document.dispose()` calls
it.

## Events

| Event | Arguments | When |
| --- | --- | --- |
| `change` | `{ canUndo, canRedo }` | After every push, undo, redo and non-empty `clear()`. |

```ts
document.history.on("change", ({ canUndo, canRedo }) => {
  undoButton.disabled = !canUndo;
  redoButton.disabled = !canRedo;
});
```
