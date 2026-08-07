# HistoryStack

Bounded undo/redo stack for `PixelArtCanvas`. Most consumers use `PixelArtCanvas.undo()`/`redo()` rather than this class directly. See [PixelArtCanvas.md](../PixelArtCanvas.md#undo--redo--canundo--canredo).

```ts
new HistoryStack(buffer: DefaultPixelBuffer, uvMap: UVMap, options?: HistoryStackOptions)
```

```ts
interface HistoryStackOptions {
  /** @default 10 */
  limit?: number;
}
```

`limit` caps the undo stack; pushing past it drops the oldest entry.

## Entry actions

| Action | What it records |
|---|---|
| `"stroke"` | `beforeColors` per-position, `afterColor` single color |
| `"resized"` / `"texture-replaced"` | Whole-buffer `beforePixels` / `afterPixels` snapshot |
| `"select-edit"` | `beforeColors`/`afterColors` per-position + `oldRect`/`newRect`/`oldMask`/`newMask` for selection state |
| `"uv-create"` / `"uv-delete"` | Full `region` (undo calls the inverse `UVMap` method) |
| `"uv-move"` | `face` (`null` when collapsed) + `oldRect` / `newRect` |
| `"uv-state"` | Whole `before` / `after` regions — collapsing discards five rects, so only a full snapshot can undo it |

> [!NOTE]
> `"select-edit"` and `"uv-*"` undo/redo are broadcast over the network. See [uv/UVMap.md](../uv/UVMap.md#history--network).

## API

### `canUndo` / `canRedo`

```ts
get canUndo(): boolean
get canRedo(): boolean
```

### `push(entry)`

```ts
push(entry: HistoryEntryInput): void
```

Stamps `Date.now()` and pushes onto the undo stack, clearing redo. Drops the oldest entry when `limit` is exceeded.

### `undo()`

```ts
undo(): HistoryEntry | null
```

Reverts the most recent entry and moves it to the redo stack. Returns `null` if nothing to undo.

### `redo()`

```ts
redo(): HistoryEntry | null
```

Re-applies the most recently undone entry and moves it back to the undo stack. Returns `null` if nothing to redo.

### `clear()`

```ts
clear(): void
```

Discards both stacks. Call when the buffer is replaced from outside (e.g. remote resize or snapshot); `PixelArtCanvas` does this automatically.
