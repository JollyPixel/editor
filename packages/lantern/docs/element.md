# jolly-lantern

The Lit element that renders a [`LanternSession`](./LanternSession.md). It needs the `lit` and
`@jolly-pixel/ui` peers.

```ts
import "@jolly-pixel/lantern/element";

const element = document.createElement("jolly-lantern");
document.querySelector("jolly-scope")!.append(element);
element.session = lantern.start(basics);
```

Append it inside the page's `jolly-scope` so the theme and density apply. `editor.host` already
mounts one per editor page.

## Overlay

The overlay sits in the top layer (`popover="manual"`), above floating panes and the log. It dims
the page with `--jolly-dialog-backdrop` and cuts a hole around the target, outlined with the focus
ring. The hole takes one of two shapes:

- A target at least 6 px away from every edge of the window, such as a floating toolbar, gets a
  hole 6 px larger on every side. Its corners are the target's corner radii plus 6 px.
- A target closer to an edge, such as a docked pane or the viewport, gets a hole of exactly its
  size with its own corner radii. The outline sides that fall on the window edge are cut off, so
  only the sides facing the dimmed page show.

A target that resolves to a grouped [`jolly-pane`](../../ui/docs/api/containers/pane.md) is
measured through its `chromeElement`, the `jolly-pane-group`, so the hole includes the tab that
carries its heading. The step's `enter` should show the pane, since the group displays whichever
tab is active.

While a step shows, the element measures the target once per animation frame and moves the hole
and the card when the rectangle changes, so a resized pane or a dialog that animates in stays
outlined. Between steps the hole and the card move over 200 ms; with `prefers-reduced-motion` they
jump.

The card is placed against the hole on the step's `side`, flipped when it does not fit, and
centred when the step has no target. It shows the tour title, the step counter (`3 / 7`), the
image, the step title, the body and the buttons Skip, Back (hidden on the first step) and Next
(Done on the last). While `session.offeredFollowUp` is set, an accent `Next tour: {title}` button
sits under them and takes the focus instead of Done.

A click on the dim area does nothing: one stray click should not throw a newcomer out of the tour.

## Keys and focus

On a passive step:

- Right arrow and Enter go to the next step, Left arrow goes back, Escape skips.
- Focus moves to Next, or to the follow-up button. When the tour ends, focus returns to the element that had it before.
- The element pushes an `inputLayers` layer, so keys never reach the 3D viewport. Dismissing the
  layer, as Ctrl+K does before opening the console, skips the tour.
- The target inside the hole does not receive clicks.

The card is `role="dialog"`, labelled by the step title, and not modal: screen readers can still
reach the page.

## Interactive steps

A step with `until` waits for the user. Next reads "Waiting…" and is disabled, clicks inside the
hole reach the target, and no input layer is pushed, so the viewport receives keys and pointer
events as usual. The arrow keys and Escape are left to the page; Skip and Back still work.

## Members

### `element.session: LanternSession | null`

Assign the session before its first step shows; the `present` callback of `Lantern` does. The
element opens on the first `step` event and closes on `end`.
