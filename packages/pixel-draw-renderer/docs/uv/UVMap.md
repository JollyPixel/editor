# UVMap

Manages the texture's UV regions. The canvas exposes it as `PixelArtCanvas.uv`.

```ts
const region = canvas.uv.create({
  width: 16,
  height: 16,
  name: "Grass block"
});

canvas.mode = "uv";
canvas.uv.select(region.id);
```

In UV mode, click a visible region to select it, drag it to move it, or press `Delete` to remove it. Create, collapse and uncollapse regions through this API.

See [`UVRegion`](./UVRegion.md) for region geometry and serialized data.

## Types

```ts
new UVMap(options: UVMapOptions)

interface UVMapOptions {
  getCanvasSize: () => Vec2;
}

type UVFaceGeometryTemplate =
  | { shape: "rectangle"; }
  | {
      shape: "triangle";
      corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    };

interface UVRegionCreateOptions {
  width: number;
  height: number;
  name?: string;
  activeFaces?: readonly UVFace[];
  faceGeometries?: Partial<Record<UVFace, UVFaceGeometryTemplate>>;
  state?: "collapsed" | "uncollapsed";
  id?: string;
  color?: string;
}
```

`width` and `height` are clamped to the canvas. The default `id` comes from `crypto.randomUUID()` and the default color comes from the built-in palette.

A region with `activeFaces` or `faceGeometries` starts uncollapsed. Other regions start collapsed. Pass `state` to override that default.

## Events

| Type | Payload |
|---|---|
| `"region-created"` | `region` |
| `"region-deleted"` | `region` |
| `"region-moved"` | `region`, `face`, `previousRect` |
| `"region-dragging"` | `id`, `face`, `rect`, `geometry` |
| `"region-state-changed"` | `region`, `previous` |
| `"selection-changed"` | `selectedRegionId`, `selectedFace` |
| `"visibility-changed"` | `showAll` |
| `"label-visibility-changed"` | `showRegionLabels` |

`face` is `null` for a collapsed region. `"region-dragging"` is a preview event; it does not mutate the map.

## Properties

### `regions`

```ts
get regions(): IterableIterator<UVRegion>
```

Live view in insertion order. `UVMap` is also iterable. Spread either value to take a snapshot.

### `selectedRegionId` / `selectedFace`

```ts
get selectedRegionId(): string | null
get selectedFace(): UVFace | null
```

The current selection. A collapsed region has no selected face. An uncollapsed region selects the requested active face or falls back to its first active face in `UV_FACES` order.

### `showAll`

```ts
get showAll(): boolean
set showAll(value: boolean)
```

When `true`, every region is visible. The default is `false`.

### `showRegionLabels`

```ts
get showRegionLabels(): boolean
set showRegionLabels(value: boolean)
```

Shows each visible region's name, falling back to its id. The default is `false`. Enabling `showAll` also displays labels without changing this preference.

## Visibility

A region is visible and hit-testable when `showAll` is enabled or its id matches `selectedRegionId`. An uncollapsed region displays all of its active faces.

Selection and visibility stay unchanged when the canvas leaves UV mode.

## Methods

### `get(id)` / `canvasSize()` / `isVisible(id)`

```ts
get(id: string): UVRegion | undefined
canvasSize(): Vec2
isVisible(id: string): boolean
```

Read a region, the current canvas size, or the computed visibility of a region.

### `create(options)`

```ts
create(options: UVRegionCreateOptions): UVRegion
```

Creates a region at a cascading position and emits `"region-created"`.

### `delete(id)`

```ts
delete(id: string): boolean
```

Removes a region and emits `"region-deleted"`. Deleting the selected region also clears selection and emits `"selection-changed"`. Returns `false` for an unknown id.

### `move(id, rect, face?)`

```ts
move(id: string, rect: SelectionRect, face?: UVFace): boolean
```

Moves the shared rectangle of a collapsed region or one face of an uncollapsed region. The rectangle is clamped to the canvas. Returns `false` when the id is unknown or an uncollapsed region has no `face`.

### `previewMove(id, rect, face?)`

```ts
previewMove(id: string, rect: SelectionRect, face?: UVFace): void
```

Emits `"region-dragging"` with clamped preview geometry. The stored region, history and network state remain unchanged.

### `uncollapse(id)` / `collapse(id, face?)`

```ts
uncollapse(id: string): boolean
collapse(id: string, face?: UVFace): boolean
```

`collapse()` chooses one shared rectangle and retains custom face topology. Without a `face` it uses the largest active face. If the requested face is triangular, it prefers the first active rectangular face.

`uncollapse()` restores the active faces, their shapes and their previous layout, translated by however far the shared rectangle moved while collapsed.

Both methods emit `"region-state-changed"`. They return `false` for an unknown id or a redundant transition.

### `select(id, face?)`

```ts
select(id: string | null, face?: UVFace): void
```

Selects a region or clears selection with `null`. For an uncollapsed region, an omitted or inactive face falls back to the first active face. Repeated clicks on coincident faces cycle through them in `UV_FACES` order.

### `restore(region)` / `restoreState(region)`

```ts
restore(region: UVRegion | UVRegionData): UVRegion
restoreState(region: UVRegion | UVRegionData): boolean
```

`restore()` adds a saved region without cascading placement and emits `"region-created"`. `restoreState()` replaces an existing region and emits `"region-state-changed"`. History and network hydration use these methods.

### `clear()`

```ts
clear(): void
```

Deletes every region and resets cascading placement and the color palette.

### `on(type, listener)` / `off(type, listener)`

```ts
on<T extends UVMapEventType>(type: T, listener: UVMapListener<T>): void
off<T extends UVMapEventType>(type: T, listener: UVMapListener<T>): void
```

Adds or removes a typed event listener.

Undo, redo and network sync consume the same mutation events. See [`HistoryStack`](../history/HistoryStack.md), [`PixelBuffer`](../buffer/PixelBuffer.md) and [`PixelSyncServer`](../network/api/PixelSyncServer.md).
