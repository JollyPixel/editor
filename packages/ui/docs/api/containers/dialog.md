# `jolly-dialog`

`jolly-dialog` wraps a native modal dialog and supplies a theme scope.

```html
<jolly-dialog heading="Delete layer?">
  <p>This cannot be undone.</p>
  <jolly-button slot="actions">Cancel</jolly-button>
</jolly-dialog>
```

| Property | Attribute | Type | Default |
|---|---|---|---|
| `heading` | | `string` | `""` |
| `dismissible` | | `boolean` | `true` |
| `headingEditable` | `heading-editable` | `boolean` | `false` |
| `open` | | `boolean` | Read-only |

`showModal()` opens the native dialog. `close(returnValue?)` closes it. The
default slot supplies body content; the `actions` slot supplies footer actions.

Escape and backdrop activation emit `jolly-cancel` when `dismissible` is true.
Closing emits `jolly-close` with `{ returnValue }`.

The header sits on `--jolly-dialog-chrome-bg`, a faint ink tint over the body
plane; the footer keeps the body plane and only its divider. Both take the same padding on
every side, `--jolly-dialog-chrome-padding`, which follows
`--jolly-row-height`, so the chrome shrinks and grows with the density.

| Token | Default |
|---|---|
| `--jolly-dialog-chrome-bg` | `--jolly-ink` at 4% over `--jolly-surface-raised` |
| `--jolly-dialog-chrome-padding` | `calc(var(--jolly-row-height) * 0.4)` |

## Editable heading

`headingEditable` renders the heading as a text input inside the same header
banner. A trimmed value that differs from `heading` commits on blur and on
Enter, emitting `jolly-heading-change` with `{ heading }`; an empty or
unchanged draft emits nothing. Escape reverts the input to `heading` and
leaves the dialog open. The dialog does not write `heading` itself: the owner
applies the new name and feeds it back.

```html
<jolly-dialog heading="Lantern" heading-editable></jolly-dialog>
```

The input is named `Title` for assistive technology. It sizes itself to its
content, up to the width of the header. Such a dialog opens with the focus on
itself rather than on the title, so showing one never arms a rename.

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
