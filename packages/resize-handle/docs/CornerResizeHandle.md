# CornerResizeHandle

## `CornerResizeHandleOptions`

```ts
interface CornerResizeHandleOptions {
  /**
   * Anchor edge for the width axis
   */
  horizontal: "left" | "right";
  /**
   * Anchor edge for the height axis
   */
  vertical: "top" | "bottom";
  /**
   * An existing handle. When omitted, a div is appended to the target.
   */
  handle?: HTMLElement;
  /**
   * Smallest target width in pixels.
   * @default 0
   */
  minWidth?: number;
  /**
   * Largest target width in pixels.
   * @default Number.POSITIVE_INFINITY
   */
  maxWidth?: number;
  /**
   * Smallest target height in pixels.
   * @default 0
   */
  minHeight?: number;
  /**
   * Largest target height in pixels.
   * @default Number.POSITIVE_INFINITY
   */
  maxHeight?: number;
}
```

## `new CornerResizeHandle(targetElt, options)`

Resizes `targetElt` on both axes at once from a single pointer drag, composing the same
per-axis math [`sizeFromDelta`](./ResizeHandle.md#sizefromdeltaoptions) uses for one edge. The
handle sits at the corner opposite both anchors: `{ horizontal: "left", vertical: "top" }`
anchors the top-left corner, so the handle itself sits bottom-right and grows the target as the
pointer moves away from that anchor.

There is no `collapsible` option and no keyboard path. The target's own `ResizeHandle`
instances already give a keyboard or screen-reader user full access to each axis
independently, so the corner handle stays pointer-only: it gets `aria-hidden="true"` and no
`tabindex` or `role`, rather than inventing a two-axis ARIA separator with no established
pattern.

`CornerResizeHandle` extends `EventTarget`, implements
[`ResizeHandleLike`](./ResizeHandle.md#resizehandlelike), and dispatches the same
`"dragStart"`, `"drag"`, and `"dragEnd"` events as `ResizeHandle`.

## `dispose()`

Stops interaction and ends an active drag. Removes a handle created by the instance. A
supplied handle stays in the DOM. Calling `dispose()` more than once has no effect.

## CSS classes

The handle element receives:

- `resize-handle`, `corner`: always present.
- `"top-left"` / `"top-right"` / `"bottom-left"` / `"bottom-right"`: the visual corner the
  handle sits at, derived from the options (the side opposite each anchor edge).

While a drag is in progress, `<html>` receives `handle-dragging` plus `nwse` (for the
top-left/bottom-right diagonal) or `nesw` (for the other diagonal), matching the standard OS
diagonal-resize cursors.
