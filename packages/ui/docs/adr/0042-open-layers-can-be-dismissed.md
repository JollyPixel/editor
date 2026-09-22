---
status: accepted
---

# An open layer can be dismissed, and a layer that refuses wins

Amends [ADR-0034](./0034-open-layers-claim-the-keyboard.md).

`@jolly-pixel/console` opens on Ctrl+K from anywhere, including while a dialog is open. It is a
native `<dialog>` opened with `showModal()`, because a modal `jolly-dialog` makes the rest of the
page inert and nothing outside the top layer could take focus. So before it opens, every open
dialog and popover has to close. Neither was discoverable: each `jolly-dialog` keeps its `<dialog>`
in its shadow root, and `inputLayers` only tracked anonymous symbols.

- `inputLayers.push()` takes an optional `{ dismiss }`, a function that closes the layer's owner and
  returns whether it did.
- `inputLayers.dismissAll()` calls every open layer's `dismiss`, newest first, and returns `true`
  only when all of them closed. A layer pushed without `dismiss` counts as refusing.
- `jolly-dialog` dismisses through its existing cancel path: it settles a pending inline
  confirmation as `false`, emits `jolly-cancel`, and closes. A dialog with `dismissible` set to
  `false` refuses and stays open.
- `PopoverController` dismisses by hiding its popover.

A caller that gets `false` must not open over the remaining layer. A non-dismissible dialog, such as
a username prompt that has to be answered, therefore blocks the console. The dialog's owner sees an
ordinary `jolly-cancel`, the event Escape already produces, so no owner needs new handling.

## Considered Options

- **Querying the DOM for open dialogs.** Every `<dialog>` sits in a shadow root, and a popover can
  sit in any component's. The walk would reach into other components' internals and still miss
  what `dismissible` means to each.
- **A new registry beside `inputLayers`.** Every overlay that claims the keyboard already registers
  there, and the two lists would have to agree.
- **Closing a non-dismissible dialog anyway.** It would resolve the prompt its owner is waiting on
  with a value the user never chose.

## Consequences

Closing layers one by one can leave some closed and one open when a layer refuses. The console does
not open in that case, and the layers that closed stay closed. That matches what Escape would have
done to each of them.
