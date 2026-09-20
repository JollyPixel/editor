# Dialog helpers

`showPrompt`, `showConfirm`, `showChoice`, and `resolveStoredPrompt` create
string-based dialogs under `document.body`.

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

`showPrompt()` resolves a trimmed string or `null`. `showConfirm()` resolves a
boolean. `showChoice()` shows a Cancel button (`cancelLabel`) followed by
`actions` in order, appends the optional `content` nodes under the message, and
resolves the picked action `value`, or `null` on cancel. `focus` names the
action focused on open. Do not use `"cancel"` as an action value.
`resolveStoredPrompt()` returns a non-empty stored value or opens a
prompt and stores its result. It accepts a `StorageAdapter` and uses
`LocalStorageAdapter` by default.

Every helper takes the header options of
[`jolly-dialog`](./dialog.md#icon-tone-and-intent): `title`, `icon`, `tone` and
`intent`. `showConfirm()` with `danger: true` defaults to `intent: "danger"`.

```ts
const resize = await showConfirm({
  title: "Resize tileset?",
  message: "Tiles outside the new grid are dropped.",
  intent: "warning"
});
```

The matching option types are `DialogHeaderOptions`, `PromptOptions`, `ConfirmOptions`,
`ChoiceOptions`, `ChoiceAction`, and `StoredPromptOptions`.

Both helpers confirm on Enter and cancel on Escape, through the
[`jolly-dialog` default action](./dialog.md#default-action). `showConfirm()`
opens with its confirm action focused; `showPrompt()` opens with the text field
focused.

Every helper resolves once the native dialog has closed, after the browser has
returned focus to the element that opened it.
