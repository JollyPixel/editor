# DOM helpers

The root entry point exports small DOM type guards used by event handlers:

- `isButtonElement(value)`
- `isDocumentOrShadowRoot(value)`
- `isInputElement(value)`
- `isSelectElement(value)`
- `isSlotElement(value)`

`readDetail<T>(event)` returns a typed custom-event detail or `null` when the
event is not a `CustomEvent`.

## Downloads

`saveFile(blob, fileName)` downloads a blob under a file name. The object URL
is revoked on the next task, after the download started.

```ts
import { saveFile } from "@jolly-pixel/ui";

saveFile(new Blob([bytes], { type: "audio/ogg" }), "door-slam.ogg");
```

## Field events

`onFieldChange(field, handler, name?)` subscribes to a field's committed value
and returns the unsubscribe. It is for elements built by hand; a field created
through [`addBinding`](./facade/binding.md) already reports through
`binding.on("change")`.

```ts
import { onFieldChange } from "@jolly-pixel/ui";

const field = document.createElement("jolly-color");
const off = onFieldChange<string>(field, (value) => {
  draft.color = value;
});
```

`name` defaults to `"jolly-change"`. Pass `"jolly-input"` to follow every
keystroke and drag instead.
