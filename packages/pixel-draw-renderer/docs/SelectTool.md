# SelectTool

`SelectTool` owns the rectangle-selection state machine for `"select"` mode: `idle` → `creating` → `selected` → `moving` → `selected`. It has no DOM or `CanvasBuffer` coupling — `CanvasManager` reads/writes pixel data itself, using the rects and snapshots this class hands back, and renders the dashed selection outline (via `SvgManager`) and the live drag preview (via `CanvasRenderer`'s floating overlay).

`CanvasManager` owns the only instance and drives it in response to `InputController`'s `onSelectStart`/`onSelectMove`/`onSelectEnd` and `onCopy`/`onPaste`/`onDelete` reports. You normally won't construct a `SelectTool` directly.

## Types

```ts
new SelectTool()

export type SelectToolState = "idle" | "creating" | "selected" | "moving";

export interface ClipboardSnapshot {
  rect: SelectionRect;
  pixels: RGBA[];
}
```

`SelectionRect` (`{ x, y, width, height }`, from `types.ts`) is always in texture-space pixel coordinates. A snapshot's `pixels` array is row-major, `rect.width * rect.height` entries long.

## Properties

### `state`

```ts
get state(): SelectToolState
```

### `rect`

```ts
get rect(): SelectionRect | null
```

The rect to render: the live drag preview while `"creating"` or `"moving"`, the static rect otherwise. `null` while idle.

### `snapshot`

```ts
get snapshot(): RGBA[] | null
```

Pixel data currently "inside" the selection. Stays valid across a move — position changes, content doesn't.

### `hasClipboard`

```ts
get hasClipboard(): boolean
```

## Methods

### `startCreate` / `updateCreate` / `finishCreate`

```ts
startCreate(pos: Vec2): SelectionRect
updateCreate(pos: Vec2): SelectionRect | null
finishCreate(snapshot: RGBA[]): void
```

Begins dragging out a new rectangle from `pos` (discarding any prior selection state — callers should already have decided via `hitTest` that this isn't the start of a move), grows it as the drag continues, then finalizes it once the caller has captured a pixel snapshot for the final rect (see `captureSnapshot`). Enters `"selected"`.

---

### `hitTest`

```ts
hitTest(pos: Vec2): boolean
```

Whether `pos` falls inside the current rect. Only meaningful while `"selected"` — `CanvasManager` uses this on mousedown to decide whether to start a move or a brand-new selection.

---

### `startMove` / `updateMove` / `finishMove`

```ts
startMove(pos: Vec2): void
updateMove(pos: Vec2): SelectionRect | null
finishMove(): { source: SelectionRect; dest: SelectionRect; } | null
```

Requires `"selected"`. Tracks the drag delta from `pos` and reports a live offset rect. `finishMove` returns the pre-move (`source`, to erase) and post-move (`dest`, to paint) rects — or `null` when the drag never actually displaced the rect (a click without movement), in which case nothing needs to be committed. Either way the tool re-enters `"selected"` at the final position.

---

### `clear`

```ts
clear(): void
```

Discards the current selection (rect + snapshot) entirely, back to `"idle"`. Does **not** clear the clipboard — a copy survives across selections and mode switches.

---

### `markErased`

```ts
markErased(eraseColor: RGBA): void
```

Updates the tool's own snapshot to reflect that the selection's contents were erased (uniform `eraseColor`), keeping it selected. The caller is responsible for actually writing `eraseColor` to the pixel buffer — see `CanvasManager`'s `#eraseRegion`.

---

### `copy` / `paste`

```ts
copy(): void
paste(): { rect: SelectionRect; pixels: RGBA[]; } | null
```

`copy` snapshots the current selection into the clipboard (no-op with nothing selected). `paste` activates the clipboard contents as the new active selection **at the exact position it was copied from** — an exact stacked duplicate, invisible until moved — and returns the rect/pixels the caller should paint onto the buffer. Returns `null` when the clipboard is empty. The clipboard survives being pasted, so it can be pasted again.

---

### `SelectTool.normalizeRect` (static)

```ts
static normalizeRect(a: Vec2, b: Vec2): SelectionRect
```

Normalizes two drag corners into a positive-size rect, inclusive of both corner pixels — `a === b` yields a 1×1 rect, which is what makes "click without dragging" fall back to selecting a single pixel with no special-case code.

---

### `SelectTool.captureSnapshot` (static)

```ts
static captureSnapshot(buffer: DefaultPixelBuffer, rect: SelectionRect): RGBA[]
```

Reads a rect's worth of pixels from `buffer` in row-major order. Positions outside the buffer bounds sample as fully transparent (`{ r: 0, g: 0, b: 0, a: 0 }`), mirroring how out-of-bounds writes are silently clipped elsewhere in this package — a selection is free to extend past the texture edge.

## Erase color and out-of-bounds behavior

`CanvasManager` resolves a single erase color (`CanvasManagerOptions.select.eraseColor`, default opaque `#FFFFFF`) used both for Delete and for vacating a Move's source rect. Committing a move or paste is a **plain overwrite** (`CanvasBuffer.drawRegion` / `drawPixels`, matching every other paint path in this package — no alpha blending), and both erase and paint are silently clipped to the buffer's bounds, so a selection can be dragged fully or partially off the texture without special-casing.

Move/Copy/Delete are local-only in this pass: no `PixelBufferHookEvent` is emitted for them, so multiplayer sessions via `PixelSyncSession` will not see select-mode edits from other peers, and there is no undo — consistent with the rest of this package, where painting has none either.
