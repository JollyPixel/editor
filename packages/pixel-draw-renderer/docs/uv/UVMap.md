# UVMap

`UVMap` owns a texture's set of UV regions — rectangular areas that can be placed, moved, and deleted independently of painting. It's a standalone value object exposed as `PixelArtCanvas.uv` (not a wrapped getter/setter), with its own typed event emitter, so a consumer never needs to grow `PixelArtCanvasOptions` with per-lifecycle callback options to react to region changes.

Creation is **API-only**: there is no canvas gesture for it (unlike `"select"` mode's drag-to-create). Call `uv.create(...)` directly — e.g. from a toolbar button. Moving an existing region, however, **is** a canvas gesture: switch `PixelArtCanvas.mode` to `"uv"`, click a visible region, and drag. `PixelArtCanvas` reflects this with a `"grab"`/`"grabbing"` cursor on the canvas while in `"uv"` mode (idle vs. actively dragging), instead of the plain arrow.

> [!IMPORTANT]
> Face assignment (mapping a region onto a specific mesh face), resizing after creation, rotation, and overlap/auto-layout handling are all out of scope for this version — deferred to a follow-up.

## Types

```ts
new UVMap(options: UVMapOptions)

interface UVMapOptions {
  /** Reports the current texture/canvas size, for placement clamping. */
  getCanvasSize: () => Vec2;
}

interface UVRegion {
  id: string;
  rect: SelectionRect; // { x, y, width, height }, texture-pixel space
  /** CSS color string used to render this region's overlay border. */
  color: string;
}

interface UVRegionCreateOptions {
  width: number;
  height: number;
  /** @default a generated id (crypto.randomUUID()) */
  id?: string;
  /** @default the next color in the built-in palette */
  color?: string;
}

type UVMapEvent =
  | { type: "region-created"; region: UVRegion; }
  | { type: "region-deleted"; region: UVRegion; } // the region's last-known state, just before removal
  | { type: "region-moved"; region: UVRegion; previousRect: SelectionRect; }
  | { type: "region-dragging"; id: string; rect: SelectionRect; } // transient, uncommitted
  | { type: "selection-changed"; selectedRegionId: string | null; }
  | { type: "visibility-changed"; showAll: boolean; };
```

`PixelArtCanvas` constructs `UVMap` internally with `getCanvasSize: () => canvasBuffer.size()`, so placement/move clamping always tracks the texture's current size, including after a `textureSize` resize.

## Properties

### `regions`

```ts
get regions(): IterableIterator<UVRegion>
```

Every region, in insertion order. A live view over the internal store (no array copy per access) — `UVMap` itself is also directly iterable (`for (const region of uv)`), backed by the same `Symbol.iterator`. Spread it (`[...uv.regions]`) if you need an actual array (e.g. to sort it, or to iterate it more than once).

---

### `selectedRegionId`

```ts
get selectedRegionId(): string | null
```

The one region currently selected, or `null`. There is exactly one selection at a time, shared between two independent triggers: clicking a visible region while `mode === "uv"`, and an external `select(id)` call (e.g. a consumer's own 3D-scene object-picking, clicking a mesh that a region's UVs were applied to).

---

### `showAll`

```ts
get showAll(): boolean
set showAll(value: boolean)
```

`false` by default. See **Visibility** below.

## Visibility

A region renders (and can be hit-tested / dragged in `"uv"` mode) only when:

```ts
showAll || region.id === selectedRegionId
```

**No region is visible by default.** This is deliberate: with several regions on one texture, showing all of them at once clutters the canvas. The intended flow is to reveal one at a time by selecting it (e.g. clicking its corresponding 3D mesh), with `showAll = true` as an explicit opt-in (e.g. a "show all UVs" checkbox) when you actually want to manage several at once.

> [!IMPORTANT]
> Switching `PixelArtCanvas.mode` away from `"uv"` does **not** change `selectedRegionId` or `showAll` — visibility is independent of mode, so a region revealed via `select(id)` stays visible while painting, panning, etc. Only an in-progress drag is cancelled on mode change (see [PixelArtCanvas.md](../PixelArtCanvas.md#mode)).

## Methods

### `create`

```ts
create(options: UVRegionCreateOptions): UVRegion
```

Creates a region at a cascading position (each new region is offset from the last by a fixed step, wrapping into further rows), clamped so its bounding box never exceeds the canvas bounds. `width`/`height` are likewise clamped to the canvas size. Emits `"region-created"`.

---

### `delete`

```ts
delete(id: string): boolean
```

Removes a region and emits `"region-deleted"` with its state just before removal. Returns `false` (no-op, no emission) for an unknown id. Clears `selectedRegionId` if the deleted region was selected.

---

### `move`

```ts
move(id: string, rect: SelectionRect): boolean
```

Repositions a region, clamped to canvas bounds. Emits `"region-moved"` with both the new `region` and the `previousRect`. Returns `false` for an unknown id.

---

### `previewMove`

```ts
previewMove(id: string, rect: SelectionRect): void
```

Emits `"region-dragging"` with a clamped, **transient** rect — no store mutation, no history entry, no network broadcast. Used internally by the built-in `"uv"`-mode drag gesture (`UVController`) so a consumer following the region (e.g. a 3D mesh mirroring it) can update live while the drag is in progress, instead of only snapping into place once the drag commits via `move()` on release. Silently ignores an unknown id.

> [!IMPORTANT]
> The region's actual `rect` is unchanged until `move()` commits it. If a drag is cancelled (e.g. switching `PixelArtCanvas.mode` away from `"uv"` mid-drag), `UVController` calls `previewMove(id, <the region's real rect>)` once more so a `"region-dragging"` listener snaps back to the committed state instead of staying stuck on the abandoned preview.

---

### `select`

```ts
select(id: string | null): void
```

Sets `selectedRegionId` (or clears it with `null`). Silently ignores an unknown id. Emits `"selection-changed"` only when the value actually changes.

---

### `restore`

```ts
restore(region: UVRegion): UVRegion
```

Re-adds a region exactly as given — no cascading placement, no palette color assignment. Emits `"region-created"` like `create()` does, so consumers don't need separate handling for it. Used internally to replay undo/redo, apply a remote `"uv-region-created"` command, and hydrate a network snapshot's `uvRegions`; rarely called directly.

---

### `clear`

```ts
clear(): void
```

Deletes every region (each triggers its own `"region-deleted"`) and resets cascading placement.

---

### `on` / `off`

```ts
on<T extends UVMapEventType>(type: T, listener: UVMapListener<T>): void
off<T extends UVMapEventType>(type: T, listener: UVMapListener<T>): void
```

Subscribes/unsubscribes a listener for one event type. A small custom typed pub/sub — not a native `EventTarget`/`CustomEvent`, so listeners get full type inference with no casts.

## History & network

Undo/redo and network sync both piggyback on the same events `create`/`delete`/`move` already emit, rather than needing separate replay logic:

- History: `"uv-create"` / `"uv-delete"` / `"uv-move"` entries in [`HistoryStack`](../history/HistoryStack.md). Undoing/redoing calls the corresponding `UVMap` method internally (e.g. undoing a create calls `delete`), which naturally re-emits the matching event — so a consumer's `"region-created"`/`"region-deleted"`/`"region-moved"` listener (e.g. one that spawns/destroys a mesh per region) needs no undo-specific branch.
- Network: `PixelArtCanvas.onBufferUpdated` fires `"uv-region-created"` / `"uv-region-deleted"` / `"uv-region-moved"` (see [buffer/PixelBuffer.md](../buffer/PixelBuffer.md)) whenever a local (non-remote, non-replaying) change occurs. `PixelSyncServer` resolves move/delete conflicts per region id, parallel to how strokes resolve per pixel; see [network/PixelSyncServer.md](../network/PixelSyncServer.md).

## Example

```ts
canvas.uv.on("region-created", ({ region }) => spawnCubeFor(region));
canvas.uv.on("region-deleted", ({ region }) => destroyCubeFor(region.id));
canvas.uv.on("region-moved", ({ region }) => updateCubeUVs(region.id, region.rect));
// Live feedback while dragging in "uv" mode — same handler, uncommitted rect.
canvas.uv.on("region-dragging", ({ id, rect }) => updateCubeUVs(id, rect));

// Toolbar "Create" button, fixed 16x16:
createButton.onclick = () => canvas.uv.create({ width: 16, height: 16 });

// Toolbar "Delete" button, deletes whatever is selected:
deleteButton.onclick = () => {
  const id = canvas.uv.selectedRegionId;
  if (id) canvas.uv.delete(id);
};

// Clicking a mesh in the 3D scene reveals its UV region on the 2D canvas:
onMeshClicked((regionId) => canvas.uv.select(regionId));
```
