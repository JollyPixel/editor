# `PopoverController`

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

## Options

```ts
interface PopoverControllerOptions {
  // An element, or a viewport rectangle. A zero-size rectangle is a point.
  anchor: () => HTMLElement | AnchorRect | null;
  popover: () => HTMLElement | null;
  gap?: number; // default 4
  side?: PopoverSide | (() => PopoverSide); // callback runs on each placement
  align?: "center" | "start" | "end"; // default "start"
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

`claimsInput` holds an [input layer](./input-layers.md).

## Members

- `show()`, `hide()`, `reposition()`, `open`.
- `onPointerEnter`, `onPointerLeave`: bound hover handlers.
- `onBeforeToggle`, `onToggle`: bound handlers for the popover's toggle
  events.

## Placement

- `show()` places the popover in the same task, so its first frame is already
  against the anchor. A popover opened by `popovertarget` is placed on
  `toggle`, which can be a frame late.
- Each placement sets `--jolly-overlay-origin` to the point nearest the
  anchor's centre, which the overlay motion scales from.
- Focus returns on close only to an element anchor.
- When a host update replaces an open popover or its element anchor, the
  controller closes it.

## Hover

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
