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

While open, the dialog holds a layer on `inputLayers`, so a viewport keyboard
guarded by it ignores the keys pressed inside the dialog. See
[Interaction helpers](../interaction/README.md#input-layers).

## Motion

The dialog and its backdrop fade and scale in on open and out on close. Dialog
helpers stay in the DOM until the exit transition ends. The same motion applies
to field popovers such as the `jolly-color` picker and control details.

| Token | Default |
|---|---|
| `--jolly-duration-enter` | `250ms` |
| `--jolly-duration-exit` | `150ms` |
| `--jolly-easing-overlay` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| `--jolly-overlay-scale` | `0.96` |

Under `prefers-reduced-motion: reduce` the transitions are disabled.

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
