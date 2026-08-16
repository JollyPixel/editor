# Utilities

## `sizeFromDelta(options)`

```ts
interface SizeFromDeltaOptions {
  /** Target size in pixels when the drag starts. */
  initialSize: number;
  /** Pointer coordinate in pixels when the drag starts. */
  startDrag: number;
  /** Current pointer coordinate in pixels. */
  current: number;
  /** Whether increasing the pointer coordinate increases the size. */
  fromStart: boolean;
  /** Smallest returned size in pixels. */
  min: number;
  /** Largest returned size in pixels. */
  max: number;
}
```

Pure resize math used by pointer and keyboard input, and reused per-axis by [`CornerResizeHandle`](./CornerResizeHandle.md).

It applies the current coordinate to the initial size according to the handle edge, then clamps the result to `min` and `max`.
