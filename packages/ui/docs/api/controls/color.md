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
  space?: "hsv" | "okhsv" | "okhsl";
  selector?: "square" | "wheel";
  channels?: "hsl" | "oklch";
  harmony?: ColorPickerHarmony;
  discrete?: boolean;
  settings: boolean; // show the picker's settings button
  eyedropper: boolean; // show the picker's eyedropper button
}
```

`space`, `selector`, `channels`, `harmony` and `discrete` pass through to the
picker. Left unset, they follow the
[app-wide defaults](./color-picker.md#app-wide-defaults). `settings` and
`eyedropper` pass through too.

- Accepts three- and six-digit hex, with or without `#`. Output is lowercase.
- Picker movement emits `jolly-input`, release emits `jolly-change`.
- Enter or blur commits a typed value.
- Escape restores the value from when the picker opened.
