# Interaction helpers

## Popovers

`PopoverController` positions a native popover against an anchor, repositions
it while open and restores focus on close.

```ts
const popup = new PopoverController(this, {
  anchor: () => this._button,
  popover: () => this._panel
});

popup.show();
popup.hide();
```

### Options

```ts
interface PopoverControllerOptions {
  // An element, or a viewport rectangle. A zero-size rectangle is a point.
  anchor: () => HTMLElement | AnchorRect | null;
  popover: () => HTMLElement | null;
  gap?: number; // default 4
  side?: PopoverSide | (() => PopoverSide); // callback runs on each placement
  align?: "center" | "start"; // default "start"
  openOnHover?: { delay?: number; }; // ms, default 200
  closeOnHoverLeave?: { delay?: number; }; // ms, default 200
  claimsInput?: boolean; // default true, holds an input layer while open
  onOpen?: () => void;
  onClose?: () => void;
  onReposition?: () => void; // after each placement, scroll and resize too
  onCancel?: (event: KeyboardEvent) => void; // Escape, before closing
}

type PopoverSide = "above" | "below" | "left" | "right";
```

### Members

- `show()`, `hide()`, `reposition()`, `open`.
- `onPointerEnter`, `onPointerLeave`: bound hover handlers.
- `onBeforeToggle`, `onToggle`: bound handlers for the popover's toggle
  events.

### Placement

- `show()` places the popover in the same task, so its first frame is already
  against the anchor. A popover opened by `popovertarget` is placed on
  `toggle`, which can be a frame late.
- Each placement sets `--jolly-overlay-origin` to the point nearest the
  anchor's centre, which the overlay motion scales from.
- Focus returns on close only to an element anchor.
- When a host update replaces an open popover or its element anchor, the
  controller closes it.

### Hover

```ts
const popup = new PopoverController(this, {
  anchor: () => this._button,
  popover: () => this._panel,
  openOnHover: { delay: 200 },
  closeOnHoverLeave: { delay: 200 },
  side: () => this.bottomToolbar ? "above" : "below"
});

html`<button popovertarget="options"
  @pointerenter=${popup.onPointerEnter}
  @pointerleave=${popup.onPointerLeave}>Options</button>
<div id="options" popover
  @pointerenter=${popup.onPointerEnter}
  @pointerleave=${popup.onPointerLeave}
  @beforetoggle=${popup.onBeforeToggle}
  @toggle=${popup.onToggle}>...</div>`;
```

- `openOnHover`: bind both handlers to the trigger. A delay of zero or less
  opens at once. Leaving the trigger cancels a pending open.
- `closeOnHoverLeave`: bind both handlers to the trigger and the popover.
  Entering either one cancels a pending close.
- Touch pointers, disabled triggers and point anchors do not open on hover.
- Hover does not move focus. Keyboard focus inside the popover keeps it open.
- The first click on the trigger of a hover-opened popover pins it open
  instead of closing it.
- `show()`, `hide()`, native toggles and disconnection cancel pending hover
  timers.

## Overflow titles

A label cut off with an ellipsis shows its full text as a native tooltip on
hover. Tree rows, field and `jolly-property-row` labels, folder headers,
context menu items and pane group tabs do this.

- `overflow-title="off"` turns it off for an element and its descendants,
  across shadow boundaries. Any other value turns it back on below an `"off"`.

```html
<jolly-scope overflow-title="off">
  <jolly-tree overflow-title="on"></jolly-tree>
  <jolly-text label="Name"></jolly-text>
</jolly-scope>
```

### `revealOverflowTitle(event: Event): void`

The `pointerenter` handler, for truncating labels a consumer renders itself.

```ts
html`<span class="label" @pointerenter=${revealOverflowTitle}>${name}</span>`;
```

### `syncOverflowTitle(element: HTMLElement): void`

Sets `title` to the element's text while `scrollWidth` exceeds `clientWidth`
and the attribute allows it, and removes it otherwise.

## Input layers

`inputLayers` records which keyboard events belong to the UI. While a layer is
open, every `keydown` and `keypress` is claimed in a `window` capture
listener. `keyup` is never claimed.

```ts
interface InputLayerOptions {
  dismiss?: () => boolean;
}

class InputLayers {
  constructor(options?: { target?: () => EventTarget });

  readonly open: boolean;
  push(options?: InputLayerOptions): () => void;
  dismissAll(): boolean;
  blocks(event: Event): boolean;
  onEngage(listener: () => void): () => void;
}

const inputLayers: InputLayers;
```

- `push()` opens a layer and returns an idempotent release.
- `blocks(event)` is `true` for a claimed event, even when a listener closed
  the last layer during its dispatch, as Escape does.
- `onEngage` listeners run when the first layer opens.
- `dismissAll()` calls `dismiss` on every layer, newest first, and returns
  `true` only when all closed. A layer without `dismiss` refuses and stays
  open. On `false`, do not open over it.

Holders:

- `jolly-dialog`, while open. Dismissing it cancels it, unless `dismissible`
  is `false`.
- Every `PopoverController` popover, unless `claimsInput` is `false`.
  Dismissing hides it.
- Hover flyouts such as `jolly-tool-button` hold none.

The shape matches the `KeyboardGuard` of `@jolly-pixel/controls`. Wire them
once, and the keyboard ignores keys pressed while a dialog or popover is open:

```ts
import { inputLayers } from "@jolly-pixel/ui";

const dispose = input.keyboard.addGuard(inputLayers);
```

## Drag sessions

### `startPointerDragSession(options): PointerDragSessionHandle`

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
