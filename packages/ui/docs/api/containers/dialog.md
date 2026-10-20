# `jolly-dialog`

`jolly-dialog` wraps a native modal dialog and supplies a theme scope.

```html
<jolly-dialog heading="Delete layer?">
  <p>This cannot be undone.</p>
  <jolly-button slot="actions">Cancel</jolly-button>
</jolly-dialog>
```

## Properties

```ts
interface Dialog {
  heading: string;
  icon: IconName;
  tone: IconTone | "";
  intent: DialogIntent | "";
  dismissible: boolean; // default true
  headingEditable: boolean; // attribute heading-editable

  readonly open: boolean;
  readonly closing: boolean; // from close() until jolly-exited
}

type DialogIntent = "info" | "success" | "warning" | "danger";
```

## Events

```ts
interface DialogEvents {
  "jolly-cancel": undefined; // Escape or backdrop, when dismissible
  "jolly-close": { returnValue: string; }; // exit transition starts
  "jolly-exited": undefined; // exit transition ends
  "jolly-heading-change": { heading: string; };
}
```

- A dialog reopened before the exit transition ends emits no `jolly-exited`.
- Keep the body mounted until `jolly-exited`, so it does not change while it
  fades out. An owner can also return `false` from `shouldUpdate` while
  `closing` is true.

## Methods

### `showModal(): Promise<void>`

Opens the native dialog.

### `close(returnValue?: string): void`

Closes it.

### `confirmInline(options: InlineConfirmOptions): Promise<boolean>`

Asks for a confirmation inside the open dialog instead of stacking a second
one. See [Inline confirmation](#inline-confirmation).

## Slots and parts

- Slots: default (body), `actions` (footer).
- Parts: `header`, `icon`, `title`, `confirmation`.
- Body children stack in a column with `--jolly-space-2` between them.
  Slotted `p`, `ul` and `ol` lose their block margins.

## Icon, tone and intent

- `icon` draws a registered glyph before the heading.
- `tone` makes the dialog a [toned area](../theme/tokens.md#toned-areas).
  Without one, it takes the tone of `icon`.
- `intent` colours the header only, leaves the content on the accent, and wins
  over `tone`.
- `DIALOG_INTENTS` lists the intents. `isDialogIntent(value)` narrows a string.
- Under forced colours the header uses system colours and the icon carries the
  intent.

Each intent paints the header with `--jolly-intent-<intent>-fill` and has a
default icon, which an explicit `icon` replaces:

- `info`: icon `info`, role `dialog`.
- `success`: icon `check`, role `dialog`.
- `warning`: icon `warning`, role `alertdialog`.
- `danger`: icon `warning`, role `alertdialog`.

```html
<jolly-dialog heading="Delete layer?" intent="danger"></jolly-dialog>
```

## Editable heading

With `heading-editable`, the heading is a text input in the header.

- Enter or blur commits a trimmed value that differs from `heading`, as
  `jolly-heading-change`. An empty or unchanged draft emits nothing.
- Escape reverts the input and leaves the dialog open.
- The dialog does not write `heading`: the owner applies the new name.
- The dialog opens with focus on itself, not on the input.

## Inline confirmation

```ts
interface InlineConfirmOptions {
  message: string;
  confirmLabel?: string; // default "OK"
  cancelLabel?: string; // default "Cancel"
  danger?: boolean;
}

const confirmed = await dialog.confirmInline({
  message: "3 blocks use this blockset and will lose their texture.",
  confirmLabel: "Remove",
  danger: true
});
```

- Resolves `true` on confirm, `false` on cancel, Escape, backdrop click or
  close. On a closed dialog it resolves `false`.
- The footer shows the message and its two buttons. The body is inert and the
  `actions` slot hidden.
- The confirm button takes focus and is the default action. Focus returns when
  the confirmation settles.
- `danger` uses the `danger` button variant and tints the footer.
- Escape answers `false` and keeps the dialog open. A second Escape closes it.
- With no dialog open, use [`showConfirm()`](./dialog-helpers.md).

## Default action

Enter activates the `actions` element with `data-default`, otherwise the last
one with `variant` `accent` or `danger`.

```html
<jolly-button slot="actions">Cancel</jolly-button>
<jolly-button slot="actions" variant="accent" data-default>Create</jolly-button>
```

- A disabled candidate, or none, leaves Enter alone.
- Buttons, links, textareas and contenteditable content keep Enter.
- Fields such as `jolly-text` commit their draft first, so the action sees the
  typed value.

## Keyboard scope

An open dialog holds an [input layer](../interaction/input-layers.md).
`inputLayers.dismissAll()` cancels it like Escape, unless `dismissible` is
`false`.

## Styling

- `--jolly-dialog-header-bg`: header fill, default `--jolly-accent-fill`.
- `--jolly-dialog-chrome-bg`: footer fill, default `--jolly-ink` at 4% over
  `--jolly-surface-raised`.
- `--jolly-dialog-chrome-padding`: header and footer padding, default
  `calc(var(--jolly-row-height) * 0.4)`.
- `--jolly-dialog-backdrop`: default `--jolly-dialog-header-bg` at 28% over
  `--jolly-scrim`, so it follows the accent, tone or intent.
- `--jolly-dialog-backdrop-filter`: default `blur(2px)`.
- A dialog that previews edits on the page behind it can set
  `--jolly-dialog-backdrop-filter: none`.

## Motion

```css
:root {
  --jolly-duration-enter: 250ms;
  --jolly-duration-exit: 150ms;
  --jolly-easing-overlay: cubic-bezier(0.22, 1, 0.36, 1);
  --jolly-overlay-scale: 0.96;
}
```

- The dialog and its backdrop fade and scale in and out.
- `jolly-context-menu` and field popovers use the same motion, scaled from
  the edge nearest their anchor.
- `prefers-reduced-motion: reduce` disables the transitions.
