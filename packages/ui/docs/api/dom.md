# DOM helpers

The root entry point exports small DOM type guards used by event handlers:

- `isButtonElement(value)`
- `isDocumentOrShadowRoot(value)`
- `isInputElement(value)`
- `isSelectElement(value)`
- `isSlotElement(value)`

`detailOf<T>(event)` returns a typed custom-event detail or `null` when the
event is not a `CustomEvent`.
