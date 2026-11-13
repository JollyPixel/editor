# `jolly-message`

`jolly-message` is a short line of text in a pane or dialog: an empty state,
a hint, a notice or an error.

```html
<jolly-message>No materials yet.</jolly-message>
<jolly-message tone="danger" role="alert">Could not load the palette.</jolly-message>
```

## Properties

```ts
type MessageTone = "muted" | "danger" | "warning";

interface Message {
  tone: MessageTone; // default "muted"
  flush: boolean; // default false
}
```

- `muted` uses `--jolly-text-muted`, `danger` uses `--jolly-danger` and
  `warning` uses `--jolly-warning`.
- The message pads itself with `--jolly-space-1` above and below and
  `--jolly-space-2` on the sides. `flush` removes the padding, for a message
  inside a container that already pads its content.
- Long words wrap anywhere.
- The element sets no role. Add `role="alert"` or `role="status"` when the
  message reports the result of an action.
