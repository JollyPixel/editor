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

In UV mode, click a visible region to select it, drag it to move it, or press `Delete` to remove it. A click outside every visible region clears the selection, unless [`uv.deselectOnEmptyClick`](../PixelArtCanvasOptions.md#uvdeselectonemptyclick) is disabled. Create regions and change their state through this API.

See [`UVRegion`](./UVRegion.md) for region geometry and serialized data.

## Types

```ts
new UVMap(options: UVMapOptions)

interface UVMapOptions {
  getCanvasSize: () => Vec2;
}

type UVSlotGeometryTemplate =
  | { shape: "rectangle"; }
  | {
      shape: "triangle";
      corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    };

interface UVRegionCreateOptions {
  width: number;
  height: number;
  name?: string;
  activeFaces?: readonly UVSlot[];
  faceGeometries?: Partial<Record<UVSlot, UVSlotGeometryTemplate>>;
  state?: UVRegionState;
  id?: string;
  color?: string;
}
```

`width` and `height` are clamped to the canvas. The default `id` comes from `crypto.randomUUID()` and the default color comes from the built-in palette.

A region with `activeFaces` or `faceGeometries` starts free. Other regions start stacked. Pass `state` to override that default; `"unfolded"` packs the net at creation and clamps it into the canvas.

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

`face` is `null` for anything but a free region, since stacked and unfolded regions move whole. `"region-dragging"` is a preview event; it does not mutate the map.

## Properties

### `regions`

```ts
get regions(): IterableIterator<UVRegion>
```

Live view in insertion order. `UVMap` is also iterable. Spread either value to take a snapshot.

### `selectedRegionId` / `selectedFace`

```ts
get selectedRegionId(): string | null
get selectedFace(): UVSlot | null
```

The current selection. Only a free region carries a selected face; it takes the requested active face or falls back to its first one in `UV_FACES` order. Stacked and unfolded regions leave `selectedFace` as `null`, so clicking one cell of a net selects the region rather than that cell.

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

A region is visible and hit-testable when `showAll` is enabled or its id matches `selectedRegionId`. Unfolded and free regions both display all of their active faces. The overlay dims the unselected faces of a free region; a net stays at full opacity throughout, since the point of unfolding is seeing every face at once.

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
move(id: string, rect: SelectionRect, face?: UVSlot): boolean
```

Moves one face of a free region, or the whole of a stacked or unfolded one, in which case `rect` is the region's bounds and `face` is ignored. The rectangle is clamped to the canvas. Returns `false` when the id is unknown or a free region has no `face`.

### `previewMove(id, rect, face?)`

```ts
previewMove(id: string, rect: SelectionRect, face?: UVSlot): void
```

Emits `"region-dragging"` with clamped preview geometry. The stored region, history and network state remain unchanged.

### `setState(id, state, face?)`

```ts
setState(id: string, state: UVRegionState, face?: UVSlot): boolean
```

Moves a region to one of the three states, emitting `"region-state-changed"` with the previous region as serialized data. Returns `false` for an unknown id or a transition that changes nothing.

`face` applies to `"stacked"` only, where it picks between equally large candidate faces. The geometry each state produces is described on [`UVRegion`](./UVRegion.md).

`"unfolded"` is the one transition this map corrects after the fact. `UVRegion.unfold()` packs the net wherever the region already sits, then `setState()` shifts the whole net back inside the canvas if it overhangs. A net larger than the texture is shifted to `0, 0` and left hanging off the far edge; the transition still succeeds, so peers never disagree about whether it happened.

Unfolding repacks from any state, so a free region's hand-placed faces are lost. Undo restores them, because `uv-state` history entries carry the whole previous region.

### `select(id, face?)`

```ts
select(id: string | null, face?: UVSlot): void
```

Selects a region or clears selection with `null`. For a free region, an omitted or inactive face falls back to the first active face; every other state ignores `face`. Repeated clicks on coincident faces cycle through them in `UV_FACES` order; a click outside every region restarts that cycle whether or not it clears the selection.

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
