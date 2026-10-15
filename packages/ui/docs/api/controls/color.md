# `jolly-color`

`jolly-color` combines an editable hex field with an anchored
[colour picker](./color-picker.md). It implements the
[shared field API](../field/shared-field-api.md).

```html
<jolly-color label="Tint" alpha></jolly-color>
```

## Properties

```ts
interface Color {
  alpha: boolean; // emit #rrggbbaa
}
```

- Accepts three- and six-digit hex, with or without `#`. Output is lowercase.
- Picker movement emits `jolly-input`, release emits `jolly-change`.
- Enter or blur commits a typed value.
- Escape restores the value from when the picker opened.
