# UVMap

Manages a texture's UV regions. Exposed as `PixelArtCanvas.uv`.

- **Creating** a region is API-only: call `uv.create(...)` (e.g. from a toolbar button). New regions are always collapsed.
- **Moving** is a canvas gesture: switch to `"uv"` mode, click a region, drag
- **Collapse/uncollapse** is API-only: `uv.uncollapse(id)` / `uv.collapse(id, face?)`

See [`UVRegion`](./UVRegion.md) for the region type itself, and what collapsed/uncollapsed mean.

```ts
new UVMap(options: UVMapOptions)

interface UVMapOptions {
  getCanvasSize: () => Vec2;
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
| `"region-moved"` | `region`, `face`, `previousRect` |
| `"region-dragging"` | `id`, `face`, `rect` (transient, not committed) |
| `"region-state-changed"` | `region`, `previous` (`UVRegionData`) |
| `"selection-changed"` | `selectedRegionId`, `selectedFace` |
| `"visibility-changed"` | `showAll` |

`face` is `null` for a collapsed region, whose single rect covers every face.

`"region-state-changed"` is deliberately **not** a delete followed by a create: a consumer mirroring regions as meshes must not tear its mesh down and rebuild it just because the region changed shape.

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

### `selectedFace`

```ts
get selectedFace(): UVFace | null
```

The face being edited within the selected region. Normalized against the region's state: always `null` for a collapsed region, always a face for an uncollapsed one (defaulting to `"front"`). Renormalized automatically when the selected region collapses or uncollapses.

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

Visibility is per **region**, not per face: a selected uncollapsed region shows all six of its faces. It has to — you cannot drag a stack apart without seeing it.

No region is visible by default. Switching `PixelArtCanvas.mode` away from `"uv"` does **not** change `selectedRegionId` or `showAll`.

## Methods

### `create(options)`

```ts
create(options: UVRegionCreateOptions): UVRegion
```

Places a new collapsed region at a cascading offset (clamped to canvas bounds). Emits `"region-created"`.

### `delete(id)`

```ts
delete(id: string): boolean
```

Removes a region. Emits `"region-deleted"`, clears selection if needed. Returns `false` for unknown id.

### `move(id, rect, face?)`

```ts
move(id: string, rect: SelectionRect, face?: UVFace): boolean
```

Repositions a collapsed region's single rect, or one face of an uncollapsed one (clamped). Emits `"region-moved"`.

Returns `false` for an unknown id, and for an uncollapsed region when `face` is omitted — moving every face at once is not supported yet.

### `previewMove(id, rect, face?)`

```ts
previewMove(id: string, rect: SelectionRect, face?: UVFace): void
```

Emits `"region-dragging"` with a transient rect — no store mutation, no history, no network broadcast. If a drag is cancelled, `UVController` calls this with the region's real rect to snap listeners back.

### `uncollapse(id)` / `collapse(id, face?)`

```ts
uncollapse(id: string): boolean
collapse(id: string, face: UVFace = "front"): boolean
```

Uncollapsing gives every face its own rect, all starting where the region already is, so the mapped mesh does not change appearance — the six rects land exactly on top of each other and the user drags them apart (see `UVController` cycling below).

Collapsing keeps `face` and discards the other five. Pass the face explicitly if you want "collapse onto what the user was editing" (`uv.collapse(id, uv.selectedFace ?? undefined)`); the default is deterministic instead.

Both emit `"region-state-changed"` and return `false` for an unknown id or a redundant transition.

### `restoreState(region)`

```ts
restoreState(region: UVRegion | UVRegionData): boolean
```

Replaces an existing region's geometry wholesale, emitting `"region-state-changed"` rather than `"region-created"`. This is how a collapse is undone — the five discarded rects cannot be recovered by uncollapsing, so the previous region is put back as-is. Returns `false` for an unknown id.

### `select(id, face?)`

```ts
select(id: string | null, face?: UVFace): void
```

Sets or clears the selection. `face` is ignored for a collapsed region and defaults to `"front"` for an uncollapsed one. Emits `"selection-changed"` only on change — including when only the face changes.

### `restore(region)`

```ts
restore(region: UVRegion | UVRegionData): UVRegion
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

## Selecting a face in a stack

Right after `uncollapse()`, all six rects coincide exactly. `UVController` handles this by **cycling**: clicking the same spot again advances to the next face under the cursor, wrapping around.

- Hit order is always `UV_FACES` order (regions in insertion order, then faces), independent of selection — that is what makes the cycle deterministic.
- Paint order differs: `UVOverlay` raises the selected face to the top and dims the rest, so you can see what you grabbed even when it sits under `front`.
- The cycle resets on a miss, on leaving `"uv"` mode, and whenever something outside the controller moves the selection (a 3D picker, undo, a peer).

Each pile of coincident rects carries exactly one label — six names stacked on one pixel would be unreadable — naming the face a click would land on: the selected face when it belongs to that pile, otherwise the topmost in hit order. So dragging a face off a stack immediately reveals the next face's name, without having to click the remainder to find out what it is. A face whose rect is unique is always named. Labels are dropped below ~40 screen pixels.

## Staying visible over the artwork

A border drawn in the region color alone vanishes wherever the texture under it is painted in that same color — a red region over red pixels. So every border is drawn twice: a casing stroke, black or white depending on the region color's brightness, with the region color over it. A casing that contrasts with the region color also contrasts with whatever that color hides against, which is why no pixel is ever sampled and `region.color` still renders literally. Face labels get the same casing via `paint-order: stroke`.

The casing is inset rather than straddling the colored stroke, so the two together cover exactly what the colored stroke alone used to. A straddling casing would spill past a region flush with the canvas edge and read as an extra pixel of canvas.

The selected entry — one face, or the whole region when collapsed — also fills with its own color at 6% opacity: enough to tell which of several coincident borders a drag would carry, faint enough to leave the texture underneath readable.

## History & network

Undo/redo and network sync reuse the same events `create`/`delete`/`move`/`collapse`/`uncollapse` emit — no separate replay handling needed.

- **History:** `"uv-create"`/`"uv-delete"`/`"uv-move"`/`"uv-state"` entries in [`HistoryStack`](../history/HistoryStack.md). Undo calls the inverse method, which re-emits the matching event naturally. `"uv-state"` stores both whole regions rather than a delta, because collapsing discards five rects that only a full snapshot can restore.
- **Network:** `onBufferUpdated` fires `"uv-region-*"` events for local changes. Conflicts resolve per **region face**, so two peers laying out different faces of the same region don't reject each other. See [buffer/PixelBuffer.md](../buffer/PixelBuffer.md) and [network/PixelSyncServer.md](../network/PixelSyncServer.md).

## Example

```ts
canvas.uv.on("region-created", ({ region }) => spawnCubeFor(region));
canvas.uv.on("region-deleted", ({ region }) => destroyCubeFor(region.id));
canvas.uv.on("region-moved", ({ region, face }) =>
  updateCubeFace(region.id, face, region.rectFor(face ?? "front")));
canvas.uv.on("region-dragging", ({ id, face, rect }) =>
  updateCubeFace(id, face, rect));
// collapse/uncollapse rewrites every face at once
canvas.uv.on("region-state-changed", ({ region }) => remapCube(region.id, region));

createButton.onclick = () => canvas.uv.create({ width: 16, height: 16 });

uncollapseButton.onclick = () => {
  const id = canvas.uv.selectedRegionId;
  if (id) canvas.uv.uncollapse(id);
};

onMeshClicked((regionId) => canvas.uv.select(regionId));
```
