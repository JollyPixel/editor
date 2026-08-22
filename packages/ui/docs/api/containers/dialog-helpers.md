# Dialog helpers

`showPrompt`, `showConfirm`, and `resolveStoredPrompt` create string-based
dialogs under `document.body`.

```ts
import {
  showConfirm,
  showPrompt
} from "@jolly-pixel/ui";

const name = await showPrompt({
  title: "New layer",
  label: "Layer name"
});
const remove = await showConfirm({
  title: "Delete layer?",
  message: "This cannot be undone.",
  danger: true
});
```

`showPrompt()` resolves a trimmed string or `null`. `showConfirm()` resolves a
boolean. `resolveStoredPrompt()` returns a non-empty stored value or opens a
prompt and stores its result. It accepts a `StorageAdapter` and uses
`LocalStorageAdapter` by default.

The matching option types are `PromptOptions`, `ConfirmOptions`, and
`StoredPromptOptions`.
