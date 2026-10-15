# `jolly-floating`

`jolly-floating` positions one pane in viewport coordinates.

```html
<jolly-floating x="8" y="8" width="320" height="360">
  <jolly-pane heading="Inspector"></jolly-pane>
</jolly-floating>
```

## Properties

```ts
interface Floating {
  x: number; // default 8
  y: number; // default 8
  width: number; // default 320
  height: number; // default 360
  minWidth: number; // attribute min-width, default 160
  minHeight: number; // attribute min-height, default 80
  hidden: boolean;
  storageKey: string; // attribute storage-key
  storage: StorageAdapter; // property only, default LocalStorageAdapter

  dragging: boolean; // set by a dock layout while it moves the window
}
```

## Events

```ts
interface FloatingEvents {
  "jolly-move": { x: number; y: number; };
  "jolly-move-end": { x: number; y: number; };
  "jolly-resize": JollyResizeDetail;
  "jolly-resize-end": JollyResizeDetail;
}
```

## Methods

### `moveTo(x: number, y: number): void`

Moves the window and keeps it in the viewport.

### `raise(): void`

Brings it above sibling floating windows.

### `clampToView(): void`

Moves it back into the viewport.

### `pane(): PaneElement | null`

The slotted pane.

## Parts

`resize-handle-right`, `resize-handle-bottom`, `resize-handle-corner`.

## Persistence

- Outside a dock layout, the window saves `x`, `y`, `width` and `height` when
  a move or resize commits, and `hidden` when it changes. It restores them
  before its first render.
- The namespace is `storageKey`, otherwise the page path plus the key of its
  pane.
- Inside a `jolly-dock-layout`, the layout stores the window instead.
