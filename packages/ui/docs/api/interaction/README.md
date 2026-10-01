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
nearest the anchor's center, which the overlay motion scales from.

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
