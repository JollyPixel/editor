# Dialog helpers

Promise-based dialogs created under `document.body`.

```ts
import {
  showChoice,
  showConfirm,
  showPrompt
} from "@jolly-pixel/ui";

const name = await showPrompt({
  title: "New layer",
  label: "Layer name"
});
const remove = await showConfirm({
  title: "Delete layer?",
  message: "This cannot be undone.",
  danger: true
});
const choice = await showChoice({
  title: "Import texture",
  message: "Replace the current texture or add a new one?",
  actions: [
    { value: "replace", label: "Replace" },
    { value: "add", label: "Add", variant: "accent" }
  ],
  focus: "add"
});
```

- Every helper resolves once the dialog has closed and focus has returned to
  the element that opened it.
- Enter confirms and Escape cancels, through the
  [default action](./dialog.md#default-action).

## Options

```ts
// Header of the dialog, see jolly-dialog.
interface DialogHeaderOptions {
  title?: string;
  icon?: IconName;
  tone?: IconTone;
  intent?: DialogIntent;
}

interface PromptOptions extends DialogHeaderOptions {
  label: string;
  defaultValue?: string;
  confirmLabel?: string; // default "OK"
  cancelLabel?: string; // default "Cancel"
}

interface ConfirmOptions extends DialogHeaderOptions {
  message: string;
  confirmLabel?: string; // default "OK"
  cancelLabel?: string; // default "Cancel"
  danger?: boolean; // also defaults intent to "danger"
}

interface ChoiceOptions<TValue extends string = string>
  extends DialogHeaderOptions {
  message: string;
  content?: readonly Node[]; // appended under the message
  actions: readonly ChoiceAction<TValue>[];
  cancelLabel?: string; // default "Cancel"
  focus?: TValue; // action focused on open
}

interface ChoiceAction<TValue extends string = string> {
  value: TValue;
  label: string;
  variant?: ButtonVariant;
}

interface StoredPromptOptions extends PromptOptions {
  storage?: StorageAdapter; // default LocalStorageAdapter
  storageKey: string;
  fallbackValue: string;
}
```

## Functions

### `showPrompt(options: PromptOptions): Promise<string | null>`

The trimmed text, or `null` on cancel. Opens with the field focused.

### `showConfirm(options: ConfirmOptions): Promise<boolean>`

Opens with the confirm button focused.

### `showChoice<TValue>(options: ChoiceOptions<TValue>): Promise<TValue | null>`

Shows Cancel, then `actions` in order. Resolves the picked `value`, or `null`
on cancel. Do not use `"cancel"` as a value.

### `resolveStoredPrompt(options: StoredPromptOptions): Promise<string>`

Returns the stored value when it is not empty. Otherwise prompts, stores the
answer, or `fallbackValue` when the answer is empty, and returns it.
