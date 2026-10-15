# `jolly-text`

`jolly-text` edits a string. It implements the
[shared field API](../field/shared-field-api.md).

```html
<jolly-text label="Name" placeholder="Unnamed"></jolly-text>
```

## Properties

```ts
interface Text {
  placeholder: string;
  value: string | typeof Mixed; // default ""
}
```

- Typing emits `jolly-input`. Enter or blur emits `jolly-change`.
- Escape discards the draft and does not close an outer dialog.
