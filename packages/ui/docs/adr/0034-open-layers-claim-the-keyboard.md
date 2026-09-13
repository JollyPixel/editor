---
status: accepted
---

# An open dialog or popover claims the keyboard, through a guard `controls` consumes

[ADR-0020](./0020-input-scope-follows-focus.md) planned an `InputScopeSource` in `ui`. It was never
built, and the gap showed up in `editors/voxel-map`: with the block dialog open, focus sits on a
button or a select, which is not editable, so Escape reached the viewport keyboard. The camera left
orbit mode and then the dialog closed. WASD and the arrows also moved the camera under the dialog.
Features patched it one at a time (`BrushShortcuts` looked for an open `dialog` in the composed path).

This record replaces the `ui` half of ADR-0020 for overlays. Focus-driven scoping of docked panes is
still open.

- `ui` exports `inputLayers`. `jolly-dialog` pushes a layer while open, and `PopoverController`
  pushes one from `beforetoggle` to close. While a layer is open, every `keydown` and `keypress` is
  recorded in a `window` capture listener.
- `controls` exports `KeyboardGuard` and `Keyboard.addGuard()`. A blocked keydown or keypress is
  ignored the way an editable target already is. Keyup is never guarded, for the reason ADR-0020
  gives. When a guard engages, held keys are released.
- The editor wires the two in one line: `input.keyboard.addGuard(inputLayers)`. Neither package
  depends on the other; the guard is structural.

Every open layer claims every key. A popover that let WASD through would move the camera behind a
color picker the user is working in.

## Considered Options

- **Checking whether a layer is open when the keyboard sees the event.** `PopoverController` closes
  on Escape in a `document` capture listener, which runs before the keyboard's bubbling listener.
  The layer is already gone by then and Escape leaks. The claim is recorded at `window` capture,
  which runs first.
- **Opening the popover layer on `toggle`.** `toggle` is dispatched a task after the popover shows
  and a task after it hides, so a fast Escape slipped past on open and a later key was blocked after
  close. `beforetoggle` is synchronous. A canceled open is released on the next task.
- **`stopPropagation()` in each overlay.** It hides the key from every other listener, not only the
  viewport, and does not cover keys an overlay does not handle.
- **Marking handled keys with `preventDefault()`.** Native `dialog` closes on Escape as a default
  action, so preventing it breaks the dialog (ADR-0020).
- **The shortcut registry of [ADR-0026](./0026-shortcut-registry.md).** It decides what a key does,
  not who receives it, and user-rebindable shortcuts are still undecided.
- **Making `jolly-tool-button` flyouts layers.** They open on hover. Crossing the toolbar would take
  WASD away and stop the camera mid-flight.

## Consequences

An editor that does not add the guard keeps the old behavior. The claim covers keys pressed while a
layer is open. The key that opens one, such as Enter on a focused button, still reaches the keyboard.
