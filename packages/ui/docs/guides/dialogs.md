# Dialogs

Ask the user something and wait for the answer. A helper covers a single
question. A dialog element of your own covers a form.

## 1. Ask one question

```ts
import { showChoice, showConfirm, showPrompt } from "@jolly-pixel/ui";

const remove = await showConfirm({
  title: "Remove orphan voxels",
  message: "12 voxels are not attached to any layer.",
  confirmLabel: "Remove",
  danger: true
});

const name = await showPrompt({
  title: "New layer",
  label: "Name",
  defaultValue: "Layer 2"
});

const mode = await showChoice({
  title: "Import texture",
  message: "Replace the current texture or add a new one?",
  actions: [
    { value: "replace", label: "Replace" },
    { value: "add", label: "Add", variant: "accent" }
  ],
  focus: "add"
});
```

- `showConfirm` resolves `false` on cancel, `showPrompt` and `showChoice`
  resolve `null`.
- Each one resolves after the dialog has closed and focus is back on the
  element that opened it, so the next step can open another dialog.
- Enter picks the default action, Escape and a click on the backdrop cancel.
- `danger` paints the header and the confirm button in the danger colour,
  with the `warning` icon unless `icon` names another registered glyph.

## 2. Add a few fields to a choice

`content` puts nodes under the message. Capture their values as the user types:

```ts
const tag = { name: "", message: "" };

const name = document.createElement("jolly-text");
name.label = "Name";
name.value = "";
name.addEventListener("jolly-input", (event) => {
  tag.name = (event as CustomEvent<JollyChangeDetail<string>>).detail.value;
});

const choice = await showChoice({
  title: "New tag",
  message: "A tag names this version so you can restore it later.",
  content: [name],
  actions: [{ value: "create", label: "Create", variant: "accent" }],
  focus: "create"
});
```

- `jolly-input` keeps `tag` current on every keystroke, so the value is there
  whichever way the action is chosen.
- Set `--jolly-field-inset-start` and `--jolly-field-inset-end` to `0px` on a
  wrapper, so the fields line up with the message. Keep the unit: the insets
  feed a `calc()`, and a bare `0` makes it invalid.
- For more than two or three fields, write a dialog element.

## 3. Write a dialog element

```ts
import { LitElement, html } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import type { Dialog, JollyChangeDetail } from "@jolly-pixel/ui";

@customElement("export-dialog")
export class ExportDialog extends LitElement {
  @query("jolly-dialog")
  declare dialog: Dialog;

  @state()
  declare scale: number;

  #settle: ((result: ExportOptions | null) => void) | null = null;

  constructor() {
    super();
    this.scale = 1;
  }

  async open(): Promise<ExportOptions | null> {
    this.#resolve(null);
    this.scale = 1;

    const { promise, resolve } = Promise.withResolvers<ExportOptions | null>();
    this.#settle = resolve;
    await this.updateComplete;
    await this.dialog.showModal();

    return promise;
  }

  override render() {
    return html`
      <jolly-dialog heading="Export" @jolly-close=${() => this.#resolve(null)}>
        <jolly-number
          label="Scale"
          min="1"
          max="8"
          .value=${this.scale}
          @jolly-change=${(event: CustomEvent<JollyChangeDetail<number>>) => {
            this.scale = event.detail.value;
          }}
        ></jolly-number>
        <jolly-button slot="actions" @click=${() => this.dialog.close()}>
          Cancel
        </jolly-button>
        <jolly-button slot="actions" variant="accent" @click=${this.#confirm}>
          Export
        </jolly-button>
      </jolly-dialog>
    `;
  }

  #confirm = () => {
    this.#resolve({ scale: this.scale });
    this.dialog.close();
  };

  #resolve(
    result: ExportOptions | null
  ): void {
    const settle = this.#settle;
    this.#settle = null;
    settle?.(result);
  }
}
```

- Resolve from the confirm handler, then close. Every other way out (Cancel,
  Escape, the backdrop) emits `jolly-close`, which resolves `null`. The first
  call wins.
- Do not read the answer from `returnValue`: a native dialog closed by Escape
  keeps the value of its previous close.
- `jolly-cancel` fires for Escape and the backdrop only. Listen to it to react
  to a dismissal specifically, not to settle.
- Enter activates the last `accent` or `danger` action, or the one marked
  `data-default`. A focused field commits its draft first.
- Keep the body unchanged until `jolly-exited`, so it does not change while it
  fades out.
- Set `dismissible` to `false` for a dialog that must be answered with a
  button.

## 4. Confirm inside an open dialog

Do not stack a second dialog over the first:

```ts
const confirmed = await this.dialog.confirmInline({
  message: "3 blocks use this blockset and will lose their texture.",
  confirmLabel: "Remove",
  danger: true
});
```

The footer shows the question and its two buttons, and the body goes inert
until it is answered.

## 5. Test code that asks

Pass the helper in, so a test answers without a DOM:

```ts
export class LayerCommands {
  #confirm: typeof showConfirm;

  constructor(
    confirm: typeof showConfirm = showConfirm
  ) {
    this.#confirm = confirm;
  }

  async removeEmpty(): Promise<void> {
    if (await this.#confirm({ title: "Remove empty layers", message: "…" })) {
      // ...
    }
  }
}

const commands = new LayerCommands(async() => true);
```

## Keyboard

An open dialog claims every key, so viewport shortcuts stop while it is open.
See [Toolbars and menus](./toolbars-and-menus.md).
