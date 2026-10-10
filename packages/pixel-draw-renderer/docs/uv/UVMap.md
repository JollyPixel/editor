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

In UV mode, click a visible region to select it, drag it to move it ([carrying the regions nested inside it](../tools/UVTool.md#carrying-nested-regions) while `Shift` is held), drag its handles to resize it when [`canvas.tools.uv.resizable`](../tools/UVTool.md) is on, call [`shortcuts.rotate()`](../input/CanvasShortcuts.md) to rotate it, or `shortcuts.delete()` to remove it. A click outside every visible region clears the selection, unless [`uv.deselectOnEmptyClick`](../PixelArtCanvasOptions.md#uvdeselectonemptyclick) is disabled. Create regions and change their state through this API.

See [`UVRegion`](./UVRegion.md) for region geometry and serialized data.

## Types

```ts
new UVMap(options: UVMapOptions)

interface UVMapOptions {
  getCanvasSize: () => Vec2;
  batch?: (apply: () => void) => void;
}

interface UVMove {
  id: string;
  rect: SelectionRect;
  slot: UVSlot | null;
}

interface UVSlotSize {
  width?: number;
  height?: number;
}

type UVSlotGeometryTemplate = UVSlotSize & (
  | { shape: "rectangle"; }
  | {
      shape: "triangle";
      corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    }
);

interface UVRegionCreateOptions {
  width: number;
  height: number;
  name?: string;
  activeSlots?: readonly UVSlot[];
  slotGeometries?: Partial<Record<UVSlot, UVSlotGeometryTemplate>>;
  state?: UVRegionState;
  id?: string;
  color?: string;
}
```

`width` and `height` are clamped to the canvas. A slot template's own `width` or `height` replaces the region's for that slot, clamped the same way; a stacked region keeps the region size for its shared rect. The default `id` comes from `crypto.randomUUID()` and the default color comes from the built-in palette.

`batch` runs an edit that changes several regions, such as [`moveGroup()`](#movegroupmoves), so the owner can record it as one history step. It defaults to calling `apply` directly. A [`PixelDocument`](../PixelDocument.md) passes its own.

A region with `activeSlots` or `slotGeometries` starts free. Other regions start stacked. Pass `state` to override that default; `"unfolded"` packs the net at creation and clamps it into the canvas.

## Events

| Type | Payload |
|---|---|
| `"changed"` | none |
| `"region-created"` | `region` |
| `"region-deleted"` | `region` |
| `"region-moved"` | `region`, `face`, `previousRect` |
| `"region-dragging"` | `region`, `face` |
| `"region-drag-ended"` | `id`, `committed` |
| `"region-state-changed"` | `region`, `previous` |
| `"region-rotated"` | `region`, `previous`, `face` |
| `"selection-changed"` | `selectedRegionId`, `selectedSlot` |
| `"visibility-changed"` | `showAll` |
| `"label-visibility-changed"` | `showRegionLabels` |
| `"size-label-visibility-changed"` | `showSizeLabels` |
| `"label-scope-changed"` | `labelScope` |

`face` is `null` for anything but a free region, since stacked and unfolded regions move, resize and rotate whole. `"region-dragging"` is the preview event of a move or resize: `region` is the region as the drag shows it, and `face` names the only slot that changes. Canvas gestures emit it on pointer-down with the initial geometry, then whenever the preview changes. It does not mutate the map. `"region-drag-ended"` closes that preview lifecycle and allows presence consumers to clear cancelled or no-op drags. `"changed"` is the consolidated rendering invalidation emitted after stored state or view preferences change.

## Properties

### `net`

```ts
net: UVNet
```

The [net](./UVNet.md) used when a region unfolds through `setState()` or is created unfolded. The default is `UVNet.packed`. Changing it leaves existing nets where they are. It is local configuration and is not synchronized: a state change sends the resulting region, so peers do not need the same net.

### `regions`

```ts
get regions(): IterableIterator<UVRegion>
```

Live view in insertion order. `UVMap` is also iterable. Spread either value to take a snapshot.

### `selectedRegionId` / `selectedSlot`

```ts
get selectedRegionId(): string | null
get selectedSlot(): UVSlot | null
```

The current selection. Only a free region carries a selected slot; it takes the requested active slot or falls back to the first active slot in the region's declared order. Stacked and unfolded regions leave the selected slot as `null`, so clicking one cell of a net selects the region rather than that cell.

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

Shows each visible region's name, falling back to its id. The default is `false`. It is independent of `showAll`, which shows every region without labelling it.

### `showSizeLabels`

```ts
get showSizeLabels(): boolean
set showSizeLabels(value: boolean)
```

Shows the size of the selected UV target in texture pixels, as `16×16`, using the bounding box of triangle and compound faces. The default is `false`. A stacked region or free slot shows it below its bottom-right corner, like the selection size, and moves it inside when it would cover another visible UV. Unfolded net faces show it inside, at the right angle of a triangle face, and hide it when it does not fit; a face being resized follows the outside rule until the drag ends. It is view state and is not synchronized.

### `labelScope`

```ts
type UVLabelScope = "all" | "selected";

get labelScope(): UVLabelScope
set labelScope(value: UVLabelScope)
```

Which visible regions carry labels. `"all"` labels every visible region; `"selected"` labels only the region matching `selectedRegionId`, while every other region keeps its border. The default is `"all"`.

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

### `move(id, rect, slot?)`

```ts
move(id: string, rect: SelectionRect, slot?: UVSlot | null): boolean
```

Moves one slot of a free region, or the whole of a stacked or unfolded one, in which case `rect` is the region's bounds and `slot` is ignored. Only the position of `rect` is used: the region keeps its current size and rotation, so a move computed before a rotation cannot undo it. The position is clamped to the canvas. Returns `false` when the id is unknown or a free region has no active `slot`.

### `previewMove(id, rect, slot?)`

```ts
previewMove(id: string, rect: SelectionRect, slot?: UVSlot | null): UVRegion | null
```

Emits `"region-dragging"` with the region `move()` would commit for the same arguments, and returns it. The stored region, history and network state remain unchanged. Returns `null` for an unknown id or a free region without an active `slot`.

### `targetsWithin(rect)`

```ts
targetsWithin(rect: SelectionRect): UVMove[]
```

Returns the visible movement units whose rectangle lies inside `rect`, edges included, each with its current `rect`: a stacked or unfolded region as a whole (`slot: null`), and each active slot of a free region. A unit that only overlaps `rect` is left out. A unit whose rectangle is `rect` itself is included.

### `moveGroup(moves)`

```ts
moveGroup(moves: readonly UVMove[]): boolean
```

Applies each move as [`move()`](#moveid-rect-slot) does, inside the `batch` option, so a document records them as one history step. Each move emits its own `"region-moved"` and syncs as its own `uv-region-moved`. Returns `true` when at least one move applied.

### `previewMoveGroup(moves)`

```ts
previewMoveGroup(moves: readonly UVMove[]): UVRegion[]
```

Previews `moveGroup()` without storing it. Moves that target the same region are folded into one preview. Emits `"region-dragging"` once per region, in move order, and returns the previewed regions in the same order. Moves that `previewMove()` would reject are skipped.

### `resize(id, rect, slot?, options?)`

```ts
resize(id: string, rect: SelectionRect, slot?: UVSlot | null, options?: UVResizeOptions): boolean
```

Gives a stacked region, or one active `slot` of an unfolded or free region, the size and position of `rect`, following [`UVRegion.resized()`](./UVRegion.md#resizedrect-slot-options). Sizes below 1px are raised to 1px. Moved edges stop at the canvas border; for an unfolded net, that includes the faces sliding with an edge. A net already past the border is not pulled back, but it cannot grow further out.

The new region is committed like a state change: it emits `"region-state-changed"` with the previous region, so it records one history step and syncs as `uv-region-state-changed`. Returns `false` for an unknown id, a region with a triangle or compound face, or an unchanged result.

### `previewResize(id, rect, slot?, options?)`

```ts
previewResize(id: string, rect: SelectionRect, slot?: UVSlot | null, options?: UVResizeOptions): UVRegion | null
```

Emits `"region-dragging"` with the region `resize()` would commit for the same arguments, and returns it. The stored region, history and network state remain unchanged. Returns `null` for an unknown id.


### `endPreview(id, committed)`

```ts
endPreview(id: string, committed: boolean): void
```

Emits `"region-drag-ended"`, closing the preview lifecycle `previewMove()` and `previewResize()` open. Call it once per drag, whether it committed or not.
### `setState(id, state, slot?)`

```ts
setState(id: string, state: UVRegionState, slot?: UVSlot | null): boolean
```

Moves a region to one of the three states, emitting `"region-state-changed"` with the previous region as serialized data. Returns `false` for an unknown id or a transition that changes nothing.

`slot` applies to `"stacked"` only, where it picks between equally large candidate faces. The geometry each state produces is described on [`UVRegion`](./UVRegion.md).

`"unfolded"` is the one transition this map corrects after the fact. `UVRegion.unfold()` lays out the map's [`net`](#net) wherever the region already sits, then `setState()` shifts the whole net back inside the canvas if it overhangs. A net larger than the texture is shifted to `0, 0` and left hanging off the far edge; the transition still succeeds, so peers never disagree about whether it happened.

Unfolding repacks from any state, so a free region's hand-placed faces are lost. Undo restores them, because a state change undoes with the whole previous region.

### `rename(id, name)`

```ts
rename(id: string, name: string): boolean
```

Replaces a region's name and keeps everything else, emitting `"region-state-changed"` so the rename reaches history and peers like any other replacement. Returns `false` for an unknown id or an unchanged name.

### `rotate(id, direction, slot?)`

```ts
rotate(id: string, direction: RotationDirection, slot?: UVSlot | null): boolean

type RotationDirection = "cw" | "ccw";
```

Turns a region 90 degrees and emits `"region-rotated"` with the previous region as serialized data. What turns depends on the state, like moving does:

- **stacked**: the shared rect and every slot.
- **unfolded**: the whole net as one piece around its bounds.
- **free**: only `slot`, in place. Without an active `slot` nothing turns.

The top-left corner stays fixed and a non-square rect swaps its width and height. The result is then clamped into the canvas: the whole region for stacked and unfolded, only the turned slot for free. Returns `false` for an unknown id or a free region without an active `slot`. See [`UVRegion.rotated()`](./UVRegion.md#rotateddirection-slot) for the geometry.

In UV mode, `shortcuts.rotate("cw")` and `shortcuts.rotate("ccw")` rotate the selected region, or the selected slot of a free region, clockwise and counter-clockwise. They do nothing during a drag.

### `select(id, slot?)`

```ts
select(id: string | null, slot?: UVSlot | null): void
```

Selects a region or clears selection with `null`. For a free region, an omitted or inactive slot falls back to the first active slot; every other state ignores `slot`. A click picks the slot the overlay paints last: the selected one when it is under the cursor, otherwise the last one in region order. Repeated clicks cycle in region order through the slots that are exactly coincident with it. A slot that merely overlaps sits below and is reachable only where it is uncovered. A click outside every region restarts that cycle whether or not it clears the selection.

### `restore(region)` / `restoreState(region)` / `restoreRotation(region, face?)`

```ts
restore(region: UVRegion | UVRegionData): UVRegion
restoreState(region: UVRegion | UVRegionData): boolean
restoreRotation(region: UVRegion | UVRegionData, face?: UVSlot | null): boolean
```

`restore()` adds a saved region without cascading placement and emits `"region-created"`. `restoreState()` replaces an existing region and emits `"region-state-changed"`. `restoreRotation()` replaces an existing region and emits `"region-rotated"` with `face`, which defaults to `null`. History and network hydration use these methods.

### `clear()`

```ts
clear(filter?: (region: UVRegion) => boolean): void
```

Deletes every region, or only those `filter` accepts, as one batch: a `"region-deleted"` per region, then `"selection-changed"` when the selected region went, then a single `"changed"`. Once the map is empty, cascading placement and the color palette reset.

### `on(type, listener)` / `off(type, listener)`

```ts
on<T extends UVMapEventType>(type: T, listener: UVMapListener<T>): void
off<T extends UVMapEventType>(type: T, listener: UVMapListener<T>): void
```

Adds or removes a typed event listener.

A [`PixelDocument`](../PixelDocument.md) turns the mutation events of the regions it owns into [commands](../PixelCommand.md) and [history steps](../history/PixelHistory.md), and applies remote commands through the same map.
