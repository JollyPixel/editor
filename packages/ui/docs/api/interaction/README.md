# Interaction helpers

## Popovers

`PopoverController` positions a native popover against an anchor, repositions
it while open, restores focus, and can handle Escape cancellation.
`PopoverControllerOptions` configures the anchor, popover, placement, and
lifecycle callbacks.

```ts
const popup = new PopoverController(this, {
  anchor: () => this._button,
  popover: () => this._panel
});
```

## Input layers

`inputLayers` records which keyboard events belong to the UI. While any layer
is open, every `keydown` and `keypress` is claimed in a `window` capture
listener, before any other listener runs. `keyup` is never claimed.

```ts
class InputLayers {
  constructor(options?: { target?: () => EventTarget });

  readonly open: boolean;
  push(): () => void;
  blocks(event: Event): boolean;
  onEngage(listener: () => void): () => void;
}

const inputLayers: InputLayers;
```

`push()` opens a layer and returns an idempotent release. `blocks(event)` is
`true` for an event claimed while a layer was open, even when a listener
closed the last layer during that event's dispatch, as Escape does.
`onEngage` listeners run when the first layer opens.

`jolly-dialog` holds a layer while it is open, and so does every popover
driven by `PopoverController`, from `beforetoggle` to close. Hover flyouts
such as `jolly-tool-button` do not.

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
