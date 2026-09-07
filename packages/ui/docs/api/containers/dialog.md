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

## Default action

Enter activates the dialog's default action: the `actions` element carrying
`data-default`, otherwise the last one whose `variant` is `accent` or `danger`.
A disabled candidate, or a dialog with neither, leaves Enter alone.

```html
<jolly-button slot="actions">Cancel</jolly-button>
<jolly-button slot="actions" variant="accent" data-default>Create</jolly-button>
```

Enter is left to the focused control when it commits the key itself: a button,
a link, a textarea, or contenteditable content. Fields such as `jolly-text`
commit their draft on Enter before the dialog acts, so the default action sees
the typed value.
