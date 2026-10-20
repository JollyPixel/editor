# `jolly-dock`

`jolly-dock` places panes along one edge and provides an inward resize handle.

```html
<jolly-dock key="left" side="left" align="start" collapsible>
  <jolly-pane key="hierarchy" heading="Hierarchy"></jolly-pane>
</jolly-dock>
```

## Properties

```ts
interface Dock {
  side: "left" | "right" | "top" | "bottom"; // default "left"
  align: "start" | "end" | null; // default null
  overlay: boolean;
  key: string;
  size: number; // default 240
  collapsible: boolean;
  collapsed: boolean;
  double: boolean;
  shareTone: boolean; // attribute share-tone
  drop: "any" | "tabs" | "none"; // default "any"
  minSize: number; // attribute min-size, default 120
  maxSize: number; // attribute max-size, default Infinity
  storageKey: string; // attribute storage-key
  storage: StorageAdapter; // property only, default LocalStorageAdapter

  readonly empty: boolean; // no slotted pane or group
  readonly split: boolean; // the secondary slot holds a pane
  readonly sharedTone: IconTone | null;
}
```

- `drop` limits what a dragged pane can do in this dock. See
  [drop rules](./dock-layout.md#drop-rules).
- `storageKey` and `storage` persist size and collapse, see
  [Storage](../storage.md).

## Events

```ts
interface DockEvents {
  "jolly-resize": JollyResizeDetail; // while the handle moves
  "jolly-resize-end": JollyResizeDetail; // on release
}

interface JollyResizeDetail {
  width: number;
  height: number;
  collapsed: boolean;
}
```

## Methods

### `slots(column?: DockColumn): DockSlot[]`

Slotted panes and groups of one column. Without a column, both columns,
primary first.

### `panes(): PaneElement[]`

Every pane of the dock, grouped ones included.

## Slots

- default: `jolly-pane` and `jolly-pane-group` children.
- `secondary`: the second column of a `double` dock.

## Empty docks

- A dock with no pane is `empty` from its first render.
- An empty dock that is not an overlay takes no space and paints nothing.
- It still accepts a dragged pane, then grows back to `size`.
- Leave `align` and `overlay` unset on a dock meant to start empty.

## Resize handle

- Double-click or Enter toggles a `collapsible` dock.
- On a dock that is not an overlay, the handle sits inside the inner edge and
  adds its thickness to `size`. A collapsed dock shrinks to the handle.
- On an overlay dock, the handle sits just past the inner edge.
- `--jolly-dock-handle-size` sets the thickness (`4px`).

## Second column

- Only a left or right `double` dock that is not an overlay opens a second
  column. `double` is ignored on top and bottom docks.
- A split dock is twice `size` wide, split equally between its columns.
- `minSize` and `maxSize` apply to each column.
- The primary column stays against the edge.
- How panes open and close the column: see
  [`jolly-dock-layout`](./dock-layout.md#second-column).

## Shared tone

- By default each pane is its own [toned area](../theme/tokens.md#toned-areas).
- With `share-tone`, every pane of the dock takes the tone of the first toned
  pane on screen: primary column first, a group through its active tab.
- `sharedTone` is that tone, or `null` when `share-tone` is off or no pane on
  screen is toned.

## Overlay pointer events

- An overlay dock is `pointer-events: none !important`, so the area around its
  panes reaches what it covers. Its panes and handle still take pointer events.
- `jolly-pane`, `jolly-floating`, `jolly-controls` and a non-overlay
  `jolly-dock` declare `pointer-events: auto`, so they work inside a
  `pointer-events: none` layer:

```css
jolly-scope {
  position: fixed;
  inset: 0;
  pointer-events: none;
}
```
