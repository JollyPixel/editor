# UVMap

Manages a texture's UV regions. Exposed as `PixelArtCanvas.uv`.

- **Creating** a region is API-only: call `uv.create(...)` (e.g. from a toolbar button)
- **Moving** is a canvas gesture: switch to `"uv"` mode, click a region, drag

```ts
new UVMap(options: UVMapOptions)

interface UVMapOptions {
  getCanvasSize: () => Vec2;
}

interface UVRegion {
  id: string;
  rect: SelectionRect; // { x, y, width, height }, texture-pixel space
  color: string;       // CSS color for the overlay border
}

interface UVRegionCreateOptions {
  width: number;
  height: number;
  id?: string;    // default: crypto.randomUUID()
  color?: string; // default: next palette color
}
```

## Events

| Type | Payload |
|---|---|
| `"region-created"` | `region` |
| `"region-deleted"` | `region` (last state before removal) |
| `"region-moved"` | `region`, `previousRect` |
| `"region-dragging"` | `id`, `rect` (transient, not committed) |
| `"selection-changed"` | `selectedRegionId` |
| `"visibility-changed"` | `showAll` |

## Properties

### `regions`

```ts
get regions(): IterableIterator<UVRegion>
```

Live view in insertion order. `UVMap` is itself iterable (`for (const r of uv)`). Spread if you need an array.

### `selectedRegionId`

```ts
get selectedRegionId(): string | null
```

The currently selected region, or `null`. Set by clicking in `"uv"` mode or by `select(id)`.

### `showAll`

```ts
get showAll(): boolean
set showAll(value: boolean)
```

`false` by default. See **Visibility** below.

## Visibility

A region is visible (and hit-testable) only when:

```ts
showAll || region.id === selectedRegionId
```

No region is visible by default. Switching `PixelArtCanvas.mode` away from `"uv"` does **not** change `selectedRegionId` or `showAll`.

## Methods

### `create(options)`

```ts
create(options: UVRegionCreateOptions): UVRegion
```

Places a new region at a cascading offset (clamped to canvas bounds). Emits `"region-created"`.

### `delete(id)`

```ts
delete(id: string): boolean
```

Removes a region. Emits `"region-deleted"`, clears selection if needed. Returns `false` for unknown id.

### `move(id, rect)`

```ts
move(id: string, rect: SelectionRect): boolean
```

Repositions a region (clamped). Emits `"region-moved"`. Returns `false` for unknown id.

### `previewMove(id, rect)`

```ts
previewMove(id: string, rect: SelectionRect): void
```

Emits `"region-dragging"` with a transient rect - no store mutation, no history, no network broadcast. If a drag is cancelled, `UVController` calls this with the region's real rect to snap listeners back.

### `select(id)`

```ts
select(id: string | null): void
```

Sets or clears `selectedRegionId`. Emits `"selection-changed"` only on change.

### `restore(region)`

```ts
restore(region: UVRegion): UVRegion
```

Re-adds a region as-is (no cascading placement). Emits `"region-created"`. Used internally for undo/redo and network hydration.

### `clear()`

```ts
clear(): void
```

Deletes all regions (each emits `"region-deleted"`) and resets cascading placement.

### `on(type, listener)` / `off(type, listener)`

```ts
on<T extends UVMapEventType>(type: T, listener: UVMapListener<T>): void
off<T extends UVMapEventType>(type: T, listener: UVMapListener<T>): void
```

Typed pub/sub. Listeners get full type inference.

## History & network

Undo/redo and network sync reuse the same events `create`/`delete`/`move` emit - no separate replay handling needed.

- **History:** `"uv-create"`/`"uv-delete"`/`"uv-move"` entries in [`HistoryStack`](../history/HistoryStack.md). Undo calls the inverse method (e.g. undoing a create calls `delete`), which re-emits the matching event naturally.
- **Network:** `onBufferUpdated` fires `"uv-region-*"` events for local changes. See [buffer/PixelBuffer.md](../buffer/PixelBuffer.md) and [network/PixelSyncServer.md](../network/PixelSyncServer.md).

## Example

```ts
canvas.uv.on("region-created", ({ region }) => spawnCubeFor(region));
canvas.uv.on("region-deleted", ({ region }) => destroyCubeFor(region.id));
canvas.uv.on("region-moved", ({ region }) => updateCubeUVs(region.id, region.rect));
canvas.uv.on("region-dragging", ({ id, rect }) => updateCubeUVs(id, rect));

createButton.onclick = () => canvas.uv.create({ width: 16, height: 16 });

deleteButton.onclick = () => {
  const id = canvas.uv.selectedRegionId;
  if (id) canvas.uv.delete(id);
};

onMeshClicked((regionId) => canvas.uv.select(regionId));
```
