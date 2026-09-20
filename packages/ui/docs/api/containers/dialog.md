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
| `icon` | | `IconName` | `""` |
| `tone` | | `IconTone | ""` | `""` |
| `intent` | | `DialogIntent | ""` | `""` |
| `dismissible` | | `boolean` | `true` |
| `headingEditable` | `heading-editable` | `boolean` | `false` |
| `open` | | `boolean` | Read-only |

`showModal()` opens the native dialog. `close(returnValue?)` closes it. The
default slot supplies body content; the `actions` slot supplies footer actions.

Escape and backdrop activation emit `jolly-cancel` when `dismissible` is true.
Closing emits `jolly-close` with `{ returnValue }`.

The header is a filled banner like a `jolly-pane` header: it sits on
`--jolly-dialog-header-bg` with `--jolly-text-on-fill` text and the same
checker wash. The footer sits on `--jolly-dialog-chrome-bg`, a faint ink tint
over the body plane. Both take the same padding on every side,
`--jolly-dialog-chrome-padding`, which follows `--jolly-row-height`, so the
chrome shrinks and grows with the density.

| Token | Default |
|---|---|
| `--jolly-dialog-header-bg` | `--jolly-accent-fill` |
| `--jolly-dialog-chrome-bg` | `--jolly-ink` at 4% over `--jolly-surface-raised` |
| `--jolly-dialog-chrome-padding` | `calc(var(--jolly-row-height) * 0.4)` |
| `--jolly-dialog-backdrop` | `--jolly-dialog-header-bg` at 28% over a themed scrim |

The backdrop is mixed from the header fill, so the fade behind the dialog takes
the accent, the tone or the intent of the dialog in front of it.

The header, its icon and its title are exposed as the `header`, `icon` and
`title` parts.

## Icon, tone and intent

`icon` draws a registered glyph before the heading.

`tone` makes the dialog a toned area, as it does for a
[`jolly-pane`](./pane.md): the header, the focus ring and the accent-filled
controls inside take the hue. Without a `tone`, the dialog follows the tone its
`icon` was registered with.

```html
<jolly-dialog heading="New layer" icon="layers" tone="teal"></jolly-dialog>
```

`intent` states what the dialog means rather than where it belongs. It colours
the header only, leaves the content on the regular accent, and wins over
`tone`. Each intent has a default icon, which an explicit `icon` replaces.

| Intent | Header token | Default icon | Role |
|---|---|---|---|
| `info` | `--jolly-intent-info-fill` | `info` | `dialog` |
| `success` | `--jolly-intent-success-fill` | `check` | `dialog` |
| `warning` | `--jolly-intent-warning-fill` | `warning` | `alertdialog` |
| `danger` | `--jolly-intent-danger-fill` | `warning` | `alertdialog` |

```html
<jolly-dialog heading="Delete layer?" intent="danger"></jolly-dialog>
```

`DIALOG_INTENTS` lists the four values and `isDialogIntent()` narrows a string
to `DialogIntent`. Under forced colours the header falls back to system
colours and the icon alone carries the intent.

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

## Inline confirmation

`confirmInline(options)` asks for a confirmation inside the open dialog instead
of stacking a second one. It resolves to `true` on confirm and `false` on
cancel, on Escape, on a backdrop click, or when the dialog closes. Called on a
closed dialog it resolves to `false`.

```ts
const confirmed = await dialog.confirmInline({
  message: "3 blocks use this tileset and will lose their texture.",
  confirmLabel: "Remove",
  danger: true
});
```

| Option | Type | Default |
|---|---|---|
| `message` | `string` | |
| `confirmLabel` | `string` | `"OK"` |
| `cancelLabel` | `string` | `"Cancel"` |
| `danger` | `boolean` | `false` |

While confirming, the body is inert, the `actions` slot is hidden and the
footer shows the message with its two buttons. The confirm button takes the
focus and is the default action; the focus returns to where it was once the
confirmation settles. `danger` gives the confirm button the `danger` variant
and tints the footer. The footer row is exposed as the `confirmation` part.

Use [`showConfirm()`](./dialog-helpers.md) when no dialog is open.

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
