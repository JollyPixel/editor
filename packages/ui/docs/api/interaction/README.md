# Interaction helpers

## Popovers

`PopoverController` positions a native popover against an anchor, repositions
it while open, restores focus, and can handle Escape cancellation.
`PopoverControllerOptions` configures the anchor, popover, placement, and
lifecycle callbacks. The anchor is an element or an `AnchorRect` in viewport
pixels; a rectangle of zero size anchors at a point. Focus returns on close
only to an element anchor.

```ts
const popup = new PopoverController(this, {
  anchor: () => this._button,
  popover: () => this._panel
});

popup.show();
popup.hide();
```

`show()` opens the popover and places it in the same task, so its first frame
is already against the anchor. A popover opened another way, such as with
`popovertarget`, is placed on its `toggle` event, which can come a frame late.
Each placement sets `--jolly-overlay-origin` on the popover to the point
nearest the anchor's center, which the overlay motion scales from, then calls
`onReposition`. That includes the placements on scroll and resize, so content
anchored inside the popover can follow it.

Omitting either hover option disables it; an empty object enables its default
delay. Hover opening is opt-in: set `openOnHover: { delay: 200 }` and bind
`onPointerEnter` and `onPointerLeave` to the trigger's `pointerenter` and
`pointerleave` events. `openOnHover.delay` is in milliseconds and defaults to 200;
zero or a negative value opens immediately. Touch pointers and disabled
triggers do not open on hover. Point anchors do not support hover opening.

Leaving the trigger cancels a pending open. By default, leaving an open
popover does not close it. Hover does not move focus; click and keyboard activation remain the trigger's responsibility.
Bind `onBeforeToggle` and `onToggle` on the popover as usual. Explicit
show/hide, native toggles and host disconnection cancel pending hover work.
Pending opens also check that the same anchor and popover are still connected.
After a host update replaces an open popover or its element anchor, the
controller closes it and releases its input layer.
`claimsInput: false` skips that input layer, for a hint that only describes
and should leave shortcuts working while it shows.

`closeOnHoverLeave: { delay: 200 }` enables closing when the pointer leaves
the trigger and popover. Bind both pointer handlers to both elements. Its
`delay` is in milliseconds, defaults to 200, and zero or negative values close
immediately. Entering either element cancels a pending close, including while
crossing the gap. Touch pointers do not schedule closing, and keyboard focus
inside the popover keeps it open. Clicking a checkbox or another control with the
pointer allows hover closing even if the control receives focus. Explicit
show/hide, native toggles and host disconnection cancel close timers too.

`side` accepts either a side string or a callback returning one, evaluated
on each placement. Use a callback for a trigger that moves between toolbars.

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

## Overflow titles

A label cut off with an ellipsis shows its full text as a native tooltip while
the pointer is over it. A label that fits gets no tooltip. Tree rows, field and
`jolly-property-row` labels, `jolly-folder` headers, context menu items and
pane group tabs all do this.

The `overflow-title` attribute turns it off. It works on any element, and the
nearest ancestor that has it wins, across shadow boundaries. Only `"off"`
disables. Any other value turns it back on below an `"off"`. With no attribute
anywhere, it is on.

```html
<jolly-scope overflow-title="off">
  <jolly-tree overflow-title="on"></jolly-tree>
  <jolly-text label="Name"></jolly-text>
</jolly-scope>
```

The check runs when the pointer enters the label, so it reflects the label's
size at that moment. `revealOverflowTitle` is that `pointerenter` handler, for
truncating labels a consumer renders itself:

```ts
html`<span class="label" @pointerenter=${revealOverflowTitle}>${name}</span>`;
```

`syncOverflowTitle(element)` applies the same rule directly: it sets the
element's `title` to its text while `scrollWidth` exceeds `clientWidth` and
the attribute allows it, and removes the `title` otherwise.

## Input layers

`inputLayers` records which keyboard events belong to the UI. While any layer
is open, every `keydown` and `keypress` is claimed in a `window` capture
listener, before any other listener runs. `keyup` is never claimed.

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

`push()` opens a layer and returns an idempotent release. `blocks(event)` is
`true` for an event claimed while a layer was open, even when a listener
closed the last layer during that event's dispatch, as Escape does.
`onEngage` listeners run when the first layer opens.

`dismiss` closes the layer's owner and returns whether it did. `dismissAll()`
calls it on every open layer, newest first, and returns `true` only when every
layer closed. A layer pushed without `dismiss` refuses. A refusing layer stays
open and the others still close. A caller that gets `false` should not open
over it; see [ADR-0020](../../adr/0020-input-scope-follows-focus.md).

`jolly-dialog` holds a layer while it is open, and so does every popover
driven by `PopoverController`, from `beforetoggle` to close. Hover flyouts
such as `jolly-tool-button` do not. A dialog dismisses like a cancel: a
pending inline confirmation settles as `false`, `jolly-cancel` fires, and the
dialog closes. With `dismissible` set to `false` it refuses. A popover
dismisses by hiding.

The shape matches the `KeyboardGuard` of `@jolly-pixel/controls`, which `ui`
does not depend on. An editor wires the two together once:

```ts
import { inputLayers } from "@jolly-pixel/ui";

const dispose = input.keyboard.addGuard(inputLayers);
```

The keyboard then ignores keys pressed while a dialog or popover is open, and
releases keys held when one opens.

## Drag sessions

`startPointerDragSession(options)` owns the shared gesture lifecycle: immediate
capture, pointer filtering, movement threshold, Escape and lost-capture
cancellation, and exactly-once teardown. It returns a
`PointerDragSessionHandle`, and reports an explicit `"commit"` or `"cancel"`
result. Domain-specific drag code supplies preview and settlement callbacks.

`startDragSession(options)` starts a pointer drag and returns a
`DragSessionHandle`. A session reports previews, a commit or cancellation, and
the selected `DragZone`. The public types include `DragResult`,
`DragSessionOptions`, and `GhostSource`. `horizontalInsertionLine()` and
`verticalInsertionLine()` compute insertion-line rectangles.

`resolveDropIndex(options)` computes an insertion index from ordered
`DropCandidate` values. `ResolveDropIndexOptions` describes that input.
`copyTheme`, `headerGhost`, and `themeTokenNames` support drag visuals that
preserve inherited theme values.
