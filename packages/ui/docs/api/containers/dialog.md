# `jolly-dialog`

`jolly-dialog` wraps a native modal dialog and supplies a theme scope.

```html
<jolly-dialog heading="Delete layer?">
  <p>This cannot be undone.</p>
  <jolly-button slot="actions">Cancel</jolly-button>
</jolly-dialog>
```

| Property | Type | Default |
|---|---|---|
| `heading` | `string` | `""` |
| `dismissible` | `boolean` | `true` |
| `open` | `boolean` | Read-only |

`showModal()` opens the native dialog. `close(returnValue?)` closes it. The
default slot supplies body content; the `actions` slot supplies footer actions.

Escape and backdrop activation emit `jolly-cancel` when `dismissible` is true.
Closing emits `jolly-close` with `{ returnValue }`.
