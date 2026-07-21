# HistoryStack

Bounded undo/redo stack over a `DefaultPixelBuffer` (`PixelBuffer` or `CanvasBuffer`), with no DOM or network dependency, so it runs identically headless or in the browser. `PixelArtCanvas`'s internal `History` owns one when constructed with `history.enabled: true` (see [PixelArtCanvas.md](../PixelArtCanvas.md#undo--redo--canundo--canredo)); most consumers drive undo/redo through `PixelArtCanvas.undo()`/`redo()` rather than this class directly.

`HistoryStack` only owns the stack and replays before/after data against its buffer; capturing that before/after data on each edit is the caller's job (`PixelArtCanvas` does this internally for strokes, resizes, and texture replaces).

## Types

```ts
new HistoryStack(buffer: DefaultPixelBuffer, uvMap: UVMap, options?: HistoryStackOptions)

interface HistoryStackOptions {
  /** @default 10 */
  limit?: number;
}

type HistoryEntry =
  | {
    action: "stroke";
    timestamp: number;
    positions: Vec2[];
    beforeColors: RGBA[];
    afterColor: RGBA;
  }
  | {
    action: "resized";
    timestamp: number;
    beforeSize: Vec2;
    beforePixels: Uint8ClampedArray;
    afterSize: Vec2;
    afterPixels: Uint8ClampedArray;
  }
  | {
    action: "texture-replaced";
    timestamp: number;
    beforeSize: Vec2;
    beforePixels: Uint8ClampedArray;
    afterSize: Vec2;
    afterPixels: Uint8ClampedArray;
  }
  | {
    action: "select-edit";
    timestamp: number;
    positions: Vec2[];
    beforeColors: RGBA[];
    afterColors: RGBA[];
    oldRect: SelectionRect;
    newRect: SelectionRect;
    oldMask: boolean[];
    newMask: boolean[];
  }
  | {
    action: "uv-create";
    timestamp: number;
    region: UVRegion;
  }
  | {
    action: "uv-delete";
    timestamp: number;
    region: UVRegion;
  }
  | {
    action: "uv-move";
    timestamp: number;
    id: string;
    oldRect: SelectionRect;
    newRect: SelectionRect;
  };

/** Same as HistoryEntry, minus `timestamp` (stamped by `push()`). */
type HistoryEntryInput = Omit<HistoryEntry, "timestamp">;
```

`limit` bounds the undo stack: pushing past it silently drops the oldest entry.

| Action | Before | After |
|---|---|---|
| `"stroke"` | `beforeColors`: per-position (a stroke can cross pixels of different colors) | `afterColor`: single color (a stroke always paints one uniform color) |
| `"resized"` / `"texture-replaced"` | `beforePixels`: whole-buffer snapshot | `afterPixels`: whole-buffer snapshot |
| `"select-edit"` | `beforeColors`: per-position | `afterColors`: per-position (unlike `"stroke"`, since these operations paint heterogeneous, multi-colored regions) |
| `"uv-create"` / `"uv-delete"` | n/a (undo calls the inverse `UVMap` method) | `region`: full state, so a delete's undo can `restore()` it exactly |
| `"uv-move"` | `oldRect` | `newRect` |

`"resized"`/`"texture-replaced"` snapshot the whole buffer since there's no cheaper diff to keep. `"select-edit"` covers every `"select"`-mode edit (move/delete/paste/rotate/flip) with a single entry shape. `positions` is the union of whatever footprint(s) the edit touched (e.g. a Move's source and destination, or a Rotate's pre/post footprint when a non-square selection's dimensions swap). `oldRect`/`oldMask` and `newRect`/`newMask` capture the active selection's rectangle and shape mask before/after the edit, so undo/redo can restore the selection itself, not just the pixels.

The `"uv-*"` entries replay by calling the corresponding [`UVMap`](../uv/UVMap.md) method directly (`delete`/`restore`/`move`) rather than touching `buffer`; see that method's own emitted event to see what a consumer observes during the replay.

> [!IMPORTANT]
> - A `"select-edit"` entry's undo/redo is never broadcast over the network; see [PixelArtCanvas.md](../PixelArtCanvas.md#undo--redo--canundo--canredo) for why.
> - A `"uv-*"` entry's undo/redo **is** broadcast (unlike `"select-edit"`), since UV regions are per-buffer network state; see [uv/UVMap.md](../uv/UVMap.md#history--network).

## Properties

### `canUndo` / `canRedo`

```ts
get canUndo(): boolean
get canRedo(): boolean
```

Whether there's an entry to undo/redo.

## Methods

### `push`

```ts
push(entry: HistoryEntryInput): void
```

Stamps the entry with the current time (`Date.now()`) and pushes it onto the undo stack, clearing the redo stack. Drops the oldest undo entry once `limit` is exceeded. The timestamp is preserved across future undo/redo replays; see [buffer/PixelBuffer.md](../buffer/PixelBuffer.md) for why this matters over the network.

---

### `undo`

```ts
undo(): HistoryEntry | null
```

Reverts the most recent entry (applying its `before*` data to the buffer) and moves it to the redo stack. Returns `null` without touching the buffer when there's nothing to undo.

---

### `redo`

```ts
redo(): HistoryEntry | null
```

Re-applies the most recently undone entry (applying its `after*` data to the buffer) and moves it back to the undo stack. Returns `null` without touching the buffer when there's nothing to redo.

---

### `clear`

```ts
clear(): void
```

Discards every recorded entry, both stacks. Call when the buffer is replaced wholesale from outside the stack's knowledge (e.g. a remote resize/texture-replace/snapshot; `PixelArtCanvas` does this automatically in `applyRemoteCommand`/`loadSnapshot`).
