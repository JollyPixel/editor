# Drag sessions

## `startPointerDragSession(options): PointerDragSessionHandle`

Owns one pointer gesture: immediate capture, movement threshold, Escape and
lost-capture cancellation, and exactly-once teardown.

```ts
interface PointerDragSessionOptions {
  element: HTMLElement;
  event: PointerEvent;
  threshold?: number; // pixels before the drag starts, default 0
  documentClass?: string; // set on the document while dragging
  suppressClick?: boolean; // swallow the release click once started
  onStart?(): void;
  onMove(clientX: number, clientY: number, event: PointerEvent): void;
  onFinish(
    result: "commit" | "cancel",
    started: boolean,
    event: PointerEvent | null
  ): void;
}

interface PointerDragSessionHandle {
  cancel(): void;
}
```

`suppressClick` keeps a dropped button from also being pressed. Keyboard
clicks still go through.

The other drag exports (`startDragSession`, `SlidingReorder`,
`resolveDropIndex`, the insertion-line and ghost helpers) drive the package's
own docks, tabs and trees.
