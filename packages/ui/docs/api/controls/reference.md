# `jolly-reference`

`jolly-reference` shows which item a property points at, such as an asset or a
scene object, with a browse button and a clear button on the right. It
implements the [shared field API](../field/shared-field-api.md).

```html
<jolly-reference label="Voxel map"></jolly-reference>
```

The field does not know what it points at, and it does not open a picker
itself. `value` is a key the consumer resolves, and `text` is the name to show
for it. Browsing emits `jolly-browse`; the consumer opens its own picker and
writes the picked key back.

## Properties

```ts
interface Reference {
  value: string | null | typeof Mixed; // default null, the referenced key
  text: string; // shown for a non-null value, falls back to the key when ""
  placeholder: string; // default "<empty>", shown when value is null
}
```

A reference whose target no longer exists keeps its key: set `text` to a name
such as `"Missing asset"`, and `error` when it needs a message under the row.

## Events

```ts
interface ReferenceEvents {
  "jolly-change": { value: string | null; }; // null from clear, default from revert
  "jolly-browse": { value: string | null; }; // null when empty or mixed
  "jolly-open": { value: string; }; // double-click or Alt+Enter on a non-null value
}
```

Browse and
clear need an editable field. `jolly-open` only needs it not to be `disabled`,
so a read-only or locked reference can still open its target.

```ts
const field = document.querySelector("jolly-reference");
field.addEventListener("jolly-browse", async(event) => {
  const picked = await pickAsset(event.detail.value);
  if (picked !== null) {
    field.value = picked.id;
    field.text = picked.name;
  }
});
onFieldChange<string | null>(field, (value) => {
  field.value = value;
  field.text = "";
});
```

## Keyboard

- Enter or Space browses.
- Alt+Enter opens a non-null value.
- Delete or Backspace clears a non-null or mixed value.
