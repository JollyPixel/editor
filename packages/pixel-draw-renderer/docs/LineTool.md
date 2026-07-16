# LineTool

`LineTool` owns the Shift-to-line armed-state machine and the Bresenham rasterization of the segment between its start and current end position. It has no knowledge of brush size or color — `CanvasManager` expands its raw points into brush-stamped pixels for both the preview and the final commit.

`CanvasManager` owns the only instance and drives it in response to `InputController`'s raw `onShiftDown`/`onShiftUp`/`onCursorMove`/`onMouseUp` reports; `InputController` itself has no knowledge of lines — it only translates DOM events into those generic callbacks. You normally won't construct a `LineTool` directly.

## Types

```ts
new LineTool()

export type LineCommitTrigger = "mousedown" | "mouseup";
```

`commitTrigger` reflects how the line was armed:
- `"mousedown"` — `Shift` was pressed while idle; the line commits on the next `mousedown`.
- `"mouseup"` — `Shift` was pressed while a freehand stroke was already in progress (mouse button held); since no new `mousedown` will fire, the line commits on the following `mouseup` instead.

## Properties

### `isArmed`

```ts
get isArmed(): boolean
```

Whether the tool currently has a start position and is tracking an end position.

### `commitTrigger`

```ts
get commitTrigger(): LineCommitTrigger
```

## Methods

### `arm`

```ts
arm(start: Vec2, commitTrigger?: LineCommitTrigger): void
```

Arms the tool at `start` (end defaults to the same position, so `getPreviewPoints()` immediately returns a single point). `commitTrigger` defaults to `"mousedown"`.

---

### `update`

```ts
update(end: Vec2): void
```

Moves the end position. No-op while unarmed.

---

### `cancel`

```ts
cancel(): void
```

Disarms the tool and clears the start/end positions.

---

### `getPreviewPoints`

```ts
getPreviewPoints(): Vec2[] | null
```

Rasterizes the current start→end segment without changing armed state. Returns `null` while unarmed.

---

### `commit`

```ts
commit(): Vec2[] | null
```

Rasterizes the current segment and disarms the tool. Returns `null` if the tool wasn't armed.

---

### `LineTool.rasterize` (static)

```ts
static rasterize(start: Vec2, end: Vec2): Vec2[]
```

Bresenham's line algorithm. A zero-length segment (`start === end`) rasterizes to a single point — this is what makes "tap Shift, click without moving" fall back to painting a single pixel with no special-case code.
