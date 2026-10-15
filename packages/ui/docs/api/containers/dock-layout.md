# `jolly-dock-layout`

`jolly-dock-layout` coordinates pane placement across docks and floating
windows.

```html
<jolly-dock-layout storage-key="editor-layout">
  <jolly-dock key="left" side="left">
    <jolly-pane key="tools" heading="Tools"></jolly-pane>
  </jolly-dock>
</jolly-dock-layout>
```

The element has `display: contents`; application CSS arranges its children.

## Properties

```ts
interface DockLayout {
  storageKey: string; // attribute storage-key
  storage: StorageAdapter; // property only, default LocalStorageAdapter
}
```

## Events

```ts
interface DockLayoutEvents {
  // A copy of the snapshot, after each saved change.
  "jolly-layout-change": { snapshot: LayoutSnapshot; };
  // After each projection, for every pane whose visibility changed.
  "jolly-pane-visibility": PaneVisibilityDetail;
}

interface PaneVisibilityDetail {
  pane: string;
  visible: boolean;
}
```

- The first projection reports every pane.
- A pane is visible when it floats, or when it is the active tab of a dock
  that is not collapsed. A folded pane is hidden unless it is grouped.

## Methods

### `docks(): Dock[]`

Docks owned by the layout.

### `panes(): PaneElement[]`

Docked and floating panes owned by the layout.

### `sync(): void`

Reconciles the current markup with the snapshot. Call it after adding panes.

### `resetLayout(): void`

Restores the authored arrangement.

### `snapshot(): LayoutSnapshot`

A copy of the current [`LayoutSnapshot`](./layout.md).

### `placement(pane: string): PanePlacement | null`

Where a docked pane sits, or `null` when it is not docked.

### `paneVisible(pane: string): boolean`

Whether the pane content is on screen, by the rule under
[Events](#events).

### `showPane(pane: string): void`

Makes a grouped pane the active tab and saves.

## State

- The snapshot is the layout's only state. Drags and keyboard moves change the
  snapshot, then the layout projects it onto docks and floating windows.
- Docks, floating windows and panes report their own changes as a
  [`LayoutChange`](./layout.md#layoutchange).

## Drop rules

- A pane dropped on a pane header or a tab strip joins that group as the
  active tab.
- A pane dropped anywhere else in a dock takes its own slot.
- Panes sharing a slot are wrapped in a `jolly-pane-group`.
- A tab moved within its own group keeps the active tab unchanged.

A dock's `drop` narrows this:

- `"any"`: both rules above.
- `"tabs"`: a pane released over a slot joins that slot's group, so panes
  never stack. It takes its own slot only in a column with no other pane.
- `"none"`: the dock takes no pane, from a drag or the keyboard. A pane
  released over it floats. Panes already inside can still leave; set
  [`locked`](./pane.md) to keep them.

## Second column

Applies to a [`double` dock](./dock.md#second-column).

- A pane dropped on the band just past the inner edge opens the second column.
- The column closes when its last pane leaves.
- When the primary column loses its last pane, the secondary panes move into
  it.
- Collapsing the dock collapses both columns.

## Floating

- A pane dropped outside every dock floats.
- Each axis of the new window takes, in order: the size the pane last floated
  at, its `floatWidth` or `floatHeight`, then its docked size. A pane hidden
  behind another tab uses its group size.
- The window is at least 160 by 80 pixels.

## Keyboard moves

Space on a pane grip or a group tab grabs the pane. Then:

- Up and Down: move within the dock.
- Left and Right: send it to the adjacent dock. A second column counts as one
  more stop, on the viewport side of the primary column.
- Shift with Up or Down: join the group above or below.
- Space: commit. Escape: cancel.

In a `"tabs"` dock, a pane sent there becomes the last tab of the column's
last group, and Up and Down never take a tab out of its group.
