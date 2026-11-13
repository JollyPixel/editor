# `DialogRequest`

`DialogRequest` turns a [`jolly-dialog`](./dialog.md) that an element renders
into a promise of its result. Use it for a dialog with its own fields; the
[dialog helpers](./dialog-helpers.md) cover prompts, confirmations and
choices.

```ts
import { DialogRequest, type Dialog } from "@jolly-pixel/ui";

class AddLayerDialog extends LitElement {
  @query("jolly-dialog")
  declare _dialog: Dialog;

  #request = new DialogRequest<AddLayerResult>(this, {
    dialog: () => this._dialog,
    focus: () => this._nameField
  });

  open(context: AddLayerContext): Promise<AddLayerResult | null> {
    this.#reset(context);

    return this.#request.open();
  }

  #confirm(): void {
    this.#request.confirm({ name: this._name });
  }

  #cancel(): void {
    this.#request.cancel();
  }
}
```

## Constructor

```ts
interface DialogRequestHost {
  readonly updateComplete: Promise<boolean>;
}

interface RequestedDialog extends EventTarget {
  showModal(): Promise<void>;
  close(returnValue?: string): void;
}

interface DialogRequestOptions {
  dialog: () => RequestedDialog;
  focus?: () => HTMLElement | null;
}

new DialogRequest<TResult>(host: DialogRequestHost, options: DialogRequestOptions);
```

`host` is usually the Lit element that renders the dialog. `dialog` and
`focus` are read when the request opens, after the host has rendered.

## Members

### `open(): Promise<TResult | null>`

Resolves a pending request with `null`, waits for the host's
`updateComplete`, shows the dialog modally and focuses the `focus` target.
The returned promise settles once, with the value passed to `confirm()`, or
with `null` when the dialog closes any other way, such as Escape.

A request cancelled or replaced by another `open()` before the host finishes
rendering never shows the dialog.

### `confirm(result: TResult, returnValue?: string): void`

Resolves the request with `result` and closes the dialog with `returnValue`,
`"confirm"` by default.

### `cancel(): void`

Resolves the request with `null` and closes the dialog with `"cancel"`.

### `pending: boolean`

`true` between `open()` and the moment the request settles.

`jolly-close` events that bubble from elements inside the dialog do not
settle the request.
