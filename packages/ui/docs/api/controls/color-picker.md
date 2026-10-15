# `jolly-color-picker`

`jolly-color-picker` is a standalone saturation, value, hue and alpha picker.
It does not use the shared field row.

```html
<jolly-color-picker value="#4488ff" alpha></jolly-color-picker>
```

## Properties

```ts
interface ColorPicker {
  value: string; // default "#000000"
  alpha: boolean;
  hexInput: boolean; // attribute hex-input, default true
  layout: "stack" | "wide"; // default "stack"
  disabled: boolean;
  readonly: boolean;
}
```

## Events

```ts
interface ColorPickerEvents {
  "jolly-input": { value: string; }; // pointer or range movement
  "jolly-change": { value: string; }; // release, or a committed text edit
}
```

`focus()` moves focus to the saturation area.

## Layouts

- `"stack"`: a 180px column with the area, a hue track, the alpha track and
  the hex footer.
- `"wide"`: a row that fills its host's height, with vertical hue and alpha
  tracks, then R, G, B, H, S, L fields and a footer with preview, hex and A.
  Give it a height. The area grows up to `--jolly-picker-area-max-width`
  (280px).

```html
<jolly-color-picker layout="wide" alpha style="height: 120px"></jolly-color-picker>
```

## Channel fields

- Accept numeric expressions, commit on Enter or blur, and clamp to their
  range: 0 to 255 for RGB, 0 to 360 for H, 0 to 100 for S, L and A.
- Escape discards the draft. An unparsable entry sets `aria-invalid`.
- Hue and saturation survive edits that reach black or grey.
