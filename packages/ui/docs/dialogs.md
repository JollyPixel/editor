# Dialogs

`jolly-dialog` wraps a native `dialog`, retaining top-layer behavior, focus management, and
Escape cancellation. It is a theme scope host.

```html
<jolly-dialog heading="Delete layer?">
  <p>This cannot be undone.</p>
  <jolly-button slot="actions">Cancel</jolly-button>
  <jolly-button slot="actions" variant="danger">Delete</jolly-button>
</jolly-dialog>
```

Call `showModal()` and `close(returnValue?)` on the element. Escape and backdrop clicks dismiss
by default and emit `jolly-cancel`; set `dismissible` to `false` when explicit actions must
decide the outcome. Closing emits `jolly-close` with `{ returnValue }`.

## String helpers

```ts
import {
  resolveStoredPrompt,
  showConfirm,
  showPrompt
} from "@jolly-pixel/ui";

const name = await showPrompt({ title: "New layer", label: "Layer name" });
const remove = await showConfirm({
  title: "Delete layer?",
  message: "This cannot be undone.",
  danger: true
});
const username = await resolveStoredPrompt({
  title: "Join session",
  label: "Username",
  storageKey: "example:username",
  fallbackValue: "Guest"
});
```

`showPrompt()` resolves a trimmed string or `null`; `showConfirm()` resolves a boolean.
Cancellation is a normal result. Use a declarative dialog for rich content, validation, or custom
forms.

`resolveStoredPrompt()` returns a non-empty cached value when available. Otherwise it opens the
same prompt, stores the confirmed value, and stores and returns `fallbackValue` on cancel or blank
confirmation. It uses `LocalStorageAdapter` by default; pass `storage` to use another adapter.
