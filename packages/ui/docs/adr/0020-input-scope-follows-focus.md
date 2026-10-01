---
status: accepted
---

# Keyboard ownership follows focus, and an open layer claims every key

A UI control and a running 3D viewport share one keyboard. `engine`'s `Keyboard` used to attach to
`document`, inspect no target, and call `preventDefault()` on 33 keys including `Tab` and `Escape`.
Exactly one scope owns the keyboard at a time, and ownership follows focus, never hover. The fix
spans three packages, and none of them depends on another:

- `engine` ignores key events whose target is editable (an exported `isEditableTarget`, resolved
  through `composedPath()`, since events crossing a shadow boundary are retargeted to the host), and
  stops preventing `Tab` and `Escape`.
- `ui` exports `inputLayers`. `jolly-dialog` pushes a layer while open, and `PopoverController`
  pushes one from `beforetoggle` to close. While a layer is open, every `keydown` and `keypress` is
  recorded in a `window` capture listener.
- `controls` exports `KeyboardGuard` and `Keyboard.addGuard()`. A blocked keydown is ignored the way
  an editable target already is, and held keys are released when a guard engages. The editor wires
  it in one line: `input.keyboard.addGuard(inputLayers)`.

Editability alone is not enough: with a dialog open, focus sits on a button or a select, so Escape
reached the viewport, the camera left orbit mode, and only then did the dialog close. Every open
layer claims every key, because a popover that let WASD through would move the camera behind a
colour picker the user is working in.

A layer can be dismissed. `inputLayers.push()` takes an optional `{ dismiss }` that closes the
layer's owner and returns whether it did, and `inputLayers.dismissAll()` calls each one newest first,
returning `true` only when all closed. A layer without `dismiss` counts as refusing, and a
`jolly-dialog` with `dismissible` set to `false` refuses. `jolly-dialog` dismisses through its cancel
path, so its owner sees the same `jolly-cancel` Escape produces. A caller that gets `false` must not
open over the remaining layer: `@jolly-pixel/console` opens on Ctrl+K from anywhere as a modal, and a
username prompt that has to be answered blocks it.

## Considered Options

- **Gating on hover**, as voxel-map once did. Moving the pointer away mid-sentence re-arms the
  engine under the user.
- **Fixing it in `engine` alone.** A focused rail button or dialog button is not editable, so keys
  still reach the viewport.
- **Guarding `keyup` alongside `keydown`.** Hold `W` on the canvas, `Tab` into a field, release: the
  guard swallows the `keyup`, `KeyW` stays held, and the camera drifts forever. Deleting a key that
  was never added is a harmless no-op, so the asymmetry is load-bearing.
- **Checking whether a layer is open when the keyboard sees the event.** `PopoverController` closes
  on Escape in a `document` capture listener, before the keyboard's bubbling listener runs, so the
  layer is already gone and Escape leaks. The claim is recorded at `window` capture, which runs
  first.
- **Opening the popover layer on `toggle`.** `toggle` is dispatched a task late on open and on close.
  `beforetoggle` is synchronous; a canceled open is released on the next task.
- **`stopPropagation()` in each overlay.** Hides the key from every other listener, not only the
  viewport, and misses keys the overlay does not handle.
- **Marking handled keys with `preventDefault()`.** Native `dialog` closes on Escape as a default
  action, so preventing it breaks the dialog.
- **Making `jolly-tool-button` flyouts layers.** They open on hover; crossing the toolbar would stop
  the camera mid-flight.
- **Querying the DOM for open dialogs to dismiss.** Every `<dialog>` sits in a shadow root, and the
  walk would still miss what `dismissible` means to each.
- **Closing a non-dismissible dialog anyway.** It would resolve a prompt its owner is waiting on with
  a value the user never chose.

## Consequences

Removing `Tab` and `Escape` from the prevented set changed a published package: a fullscreen canvas
now loses focus on `Tab`. The events still emit, so the opt-out is one line
(`keyboard.on("Tab", (event) => event.preventDefault())`).

An editor that does not add the guard keeps the old behaviour. The key that opens a layer, such as
Enter on a focused button, still reaches the keyboard. Focus-driven scoping of docked panes, beyond
editable targets, is not built.

`dismissAll()` can leave some layers closed and one open when a layer refuses. The caller does not
open, and the closed layers stay closed, as Escape would have left each of them.
