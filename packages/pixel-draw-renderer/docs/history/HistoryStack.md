# HistoryStack

Bounded undo/redo stack. It stores entries and moves them between its two stacks; it applies nothing. `PixelDocument` keeps its [entries](#entries) in one, and most consumers use `PixelArtCanvas.undo()`/`redo()`. See [PixelArtCanvas.md](../PixelArtCanvas.md#undo--redo--canundo--canredo).

```ts
new HistoryStack<TEntry>(options?: HistoryStackOptions)
```

```ts
interface HistoryStackOptions {
  /** @default 10 */
  limit?: number;
}
```

`limit` caps the undo stack; pushing past it drops the oldest entry.

## API

### `canUndo` / `canRedo`

```ts
get canUndo(): boolean
get canRedo(): boolean
```

### `undoDepth` / `redoDepth`

```ts
get undoDepth(): number
get redoDepth(): number
```

The number of entries on each stack. `undoDepth` never exceeds `limit`.

### `push(entry)`

```ts
push(entry: TEntry): void
```

Pushes onto the undo stack and clears the redo stack. Drops the oldest entry when `limit` is exceeded.

### `undo()` / `redo()`

```ts
undo(): TEntry | null
redo(): TEntry | null
```

Moves the most recent entry to the other stack and returns it, or returns `null` when that stack is empty.

### `clear()`

```ts
clear(): void
```

Discards both stacks.

## Entries

```ts
interface HistoryEntry {
  timestamp: number;
  redo: DocumentCommand[];
  undo: DocumentCommand[];
  selection?: SelectionChange;
}

interface SelectionChange {
  before: SelectionFootprint;
  after: SelectionFootprint;
}

interface SelectionFootprint {
  rect: SelectionRect;
  mask: boolean[];
}
```

A `PixelDocument` entry holds the [commands](../PixelCommand.md) that redo and undo one local edit. Undo applies `undo`, redo applies `redo`, and both emit the applied commands with `originTimestamp` set to `timestamp`. A stroke's `undo` holds one `stroke` per previous color. A resize, texture replacement or clear holds the whole texture before and after as `texture-replaced`. A UV region deletion also restores the region's normal map zone. `selection` is set by selection edits; `PixelArtCanvas` uses it to restore the selection outline while select mode is active.
