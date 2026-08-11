# API reference

## `ResizeHandleOptions`

```ts
interface ResizeHandleOptions {
  /**
   * The direction in which the handle resizes the target.
   * Also controls where the handle element is inserted in the DOM:
   * - "left" / "top"  → handle inserted after the target
   * - "right" / "bottom" → handle inserted before the target
   */
  direction: "left" | "right" | "top" | "bottom";
  /**
   * When true, double-clicking the handle collapses the target to zero size.
   * Double-clicking again restores the previous size.
   * @default false
   */
  collapsible?: boolean;
  /** Existing handle. No sibling is injected when provided. */
  handle?: HTMLElement;
  /** Smallest target size in pixels. @default 0 */
  minSize?: number;
  /** Largest target size in pixels. @default Infinity */
  maxSize?: number;
}
```

`collapsable` was removed. Use `collapsible`.

`minSize` must be a finite, non-negative number. `maxSize` must be greater than or equal to
`minSize`; it may be `Infinity`. Invalid bounds throw a `RangeError` during construction.

## `new ResizeHandle(targetElt, options)`

Creates a resize handle for `targetElt`. A `<div class="resize-handle">` is inserted next to the
target. A matching `div.resize-handle` sibling is reused when one exists.

Pass `handle` to use an existing element, including one owned by a shadow root. The supplied
element receives the resize classes and accessibility attributes and is never removed by
`dispose()`. If the supplied handle is inside the resize target, keep `collapsible` disabled and
let the owning component implement collapse so the handle remains available to restore it.

An invalid `direction` throws an `Error`.

The handle is a focusable separator. Left and right handles use
`aria-orientation="vertical"`; top and bottom handles use `"horizontal"`. `aria-valuemin`,
`aria-valuemax`, and `aria-valuenow` report the active bounds and size. An infinite maximum omits
`aria-valuemax`.

Use the arrow keys along the resize axis to change the target by 8px. Hold Shift for a 32px step.
Keyboard input respects `minSize` and `maxSize` and dispatches the same drag event sequence as
pointer input.

`ResizeHandle` extends `EventTarget` and dispatches these events:

- **`"dragStart"`**: fired when pointer or keyboard resizing starts.
- **`"drag"`**: fired after each pointer or keyboard size update.
- **`"dragEnd"`**: fired when pointer resizing ends, after a keyboard update, or when
  `dispose()` ends an active drag.

## `dispose()`

Stops interaction and ends an active drag. It removes a handle created by the instance. Supplied
handles and matching sibling handles remain in the DOM. Calling `dispose()` more than once has
no effect.

## `sizeFromDelta(options)`

Pure resize math used by pointer and keyboard input. It applies the current coordinate to the
initial size according to the handle edge, then clamps the result to `min` and `max`.

## CSS classes

The handle element (`handleElt`) receives these classes:

- `resize-handle`: always present, identifies the element.
- `"left"` / `"right"` / `"top"` / `"bottom"`: matches the `direction` option.
- `collapsible`: present when `collapsible: true`.
- `disabled`: add this class to pause pointer and keyboard interaction without disposal.

While a drag is in progress, `<html>` receives:

- `handle-dragging`: always set during a pointer drag.
- `vertical`: set for horizontal sizing (`"left"` / `"right"`).
- `horizontal`: set for vertical sizing (`"top"` / `"bottom"`).
