---
"@jolly-pixel/engine": minor
---

`Keyboard` no longer competes with focused UI for the keyboard.

Two changes, both fixing cases where the engine consumed keystrokes meant for a control:

- `keydown` and `keypress` are ignored when the event originates inside an editable element
  (`input`, `textarea`, `contenteditable`). Previously the listener attached to `document` and
  inspected no target, so typing in a text field also drove the camera, and `keypress` fed the
  typed characters into `keyboard.char`. The check is exported as `isEditableTarget(event)` and
  resolves through `composedPath()`, so a control inside a shadow root is matched rather than the
  custom element it was retargeted to. `keyup` is deliberately not filtered: dropping a release
  would leave a key held on the canvas stuck in `buttonsDown` after focus moved to a field.

- `Tab` and `Escape` are removed from the prevented key set. Preventing `Tab` trapped focus on the
  canvas, so a keyboard user could never reach surrounding UI, which also defeated any attempt to
  gate input from the UI side. Preventing `Escape` suppressed the browser default action that
  native `dialog` closes on.

Both keys still emit as before, so a game that wants the old behaviour can prevent them itself:

```ts
keyboard.on("Tab", (event) => event.preventDefault());
```
