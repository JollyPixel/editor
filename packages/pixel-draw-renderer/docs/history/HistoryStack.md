# HistoryStack

Bounded undo/redo stack over a `DefaultPixelBuffer` (`PixelBuffer` or `CanvasBuffer`) — no DOM or network dependency, so it runs identically headless or in the browser. `CanvasManager` owns one internally when constructed with `history.enabled: true` (see [CanvasManager.md](../CanvasManager.md#undo--redo--canundo--canredo)); most consumers drive undo/redo through `CanvasManager.undo()`/`redo()` rather than this class directly.

`HistoryStack` only owns the stack and replays before/after data against its buffer — capturing that before/after data on each edit is the caller's job (`CanvasManager` does this internally for strokes, resizes, and texture replaces).

## Types

```ts
new HistoryStack(buffer: DefaultPixelBuffer, options?: HistoryStackOptions)

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
  };

/** Same as HistoryEntry, minus `timestamp` — stamped by `push()`. */
type HistoryEntryInput = Omit<HistoryEntry, "timestamp">;

interface ColorGroup {
  color: RGBA;
  positions: Vec2[];
}
```

`limit` bounds the undo stack: pushing past it silently drops the oldest entry. A `"stroke"` entry's `beforeColors` is per-position (a stroke can cross pixels of different colors); `afterColor` is a single color since a stroke always paints one uniform color. `"resized"`/`"texture-replaced"` instead snapshot the whole buffer (`beforePixels`/`afterPixels`) since there's no cheaper diff to keep. `"select-edit"` covers every `"select"`-mode edit (move/delete/paste/rotate/flip) with a single entry shape: unlike `"stroke"`, both `beforeColors` and `afterColors` are per-position, since these operations paint heterogeneous, multi-colored regions rather than one uniform color. `positions` is the union of whatever footprint(s) the edit touched (e.g. a Move's source and destination, or a Rotate's pre/post footprint when a non-square selection's dimensions swap) — see [CanvasManager.md](../CanvasManager.md#undo--redo--canundo--canredo) for the network-sync caveat specific to this entry type.

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

Stamps the entry with the current time (`Date.now()`) and pushes it onto the undo stack, clearing the redo stack. Drops the oldest undo entry once `limit` is exceeded. The timestamp is preserved across future undo/redo replays — see [buffer/PixelBuffer.md](../buffer/PixelBuffer.md) for why this matters over the network.

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

Discards every recorded entry, both stacks. Call when the buffer is replaced wholesale from outside the stack's knowledge (e.g. a remote resize/texture-replace/snapshot — `CanvasManager` does this automatically in `applyRemoteCommand`/`loadSnapshot`).

## `groupPositionsByColor`

```ts
function groupPositionsByColor(positions: Vec2[], colors: RGBA[]): ColorGroup[]
```

Buckets same-length `positions`/`colors` arrays by identical color, so a heterogeneous per-pixel restore (a stroke's `beforeColors`) can be applied as a few uniform-color `drawPixels` calls instead of one call per pixel. Exported standalone since it's also used by the (internal) undo/redo network-replay event builder.
