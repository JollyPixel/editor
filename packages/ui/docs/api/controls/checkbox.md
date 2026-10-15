# `jolly-checkbox`

`jolly-checkbox` edits a boolean value. It implements the
[shared field API](../field/shared-field-api.md).

```html
<jolly-checkbox label="Visible" clickable-background></jolly-checkbox>
```

## Properties

```ts
interface Checkbox {
  clickableBackground: boolean; // attribute clickable-background
}
```

- The native checkbox supplies keyboard behaviour.
- `Mixed` shows as indeterminate. Activating it commits `true`.
- Activation emits `jolly-change`.
