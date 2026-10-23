# `jolly-color-picker`

`jolly-color-picker` is a standalone colour picker: a square or a wheel, a hue
or value track, and an optional alpha track. It does not use the shared field
row.

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
  space?: "hsv" | "okhsv";
  selector?: "square" | "wheel";
  channels?: "hsl" | "oklch";
  harmony?: ColorPickerHarmony;
  discrete?: boolean;
  settings: boolean; // show the settings button
  disabled: boolean;
  readonly: boolean;
}
```

## Events

```ts
interface ColorPickerEvents {
  "jolly-input": { value: string; }; // pointer or range movement
  "jolly-change": { value: string; }; // release, or a committed text edit
  "jolly-secondary": { value: string; }; // right click on a harmony swatch
}
```

A left click on a harmony swatch adopts the colour and emits `jolly-change`. A
right click leaves the picker alone and emits `jolly-secondary`, so the host
can use the colour elsewhere, such as a background colour.

`focus()` moves focus to the saturation area.

## Layouts

- `"stack"`: a 180px column with the area, a hue track, the alpha track and
  the hex footer.
- `"wide"`: a row that fills its host's height, with vertical hue (or value)
  and alpha tracks, then the channel fields and a footer with preview, hex and
  A. `channels` picks the second column: H, S, L (`"hsl"`) or OKLCH L, C, H
  (`"oklch"`).
  Give it a height. The area grows up to `--jolly-picker-area-max-width`
  (280px).

```html
<jolly-color-picker layout="wide" alpha style="height: 120px"></jolly-color-picker>
```

## Colour spaces and selectors

`space` picks the model the square, wheel and tracks move through:

- `"hsv"`: classic HSV. Equal steps do not look equal; yellow looks much
  lighter than blue at the same value.
- `"okhsv"`: OKHSV, built on OKLab. Value and hue steps look even, and every
  point stays inside sRGB.

`selector` picks the 2D surface:

- `"square"`: saturation across, value up, with a hue track.
- `"wheel"`: hue around a disc (0° at the top, clockwise) and saturation
  outward from the gray centre, with a value track. `discrete` snaps the
  wheel to 30° hue sectors and quarter saturation rings, and paints it that
  way.

`harmony` adds a row of swatches for a colour scheme computed in the active
space. On the wheel, markers show where each harmony colour sits.

```ts
type ColorPickerHarmony =
  | "none"
  | "complementary"
  | "monochromatic"
  | "analogous"
  | "split-complementary"
  | "triadic"
  | "tetradic"
  | "square";
```

```html
<jolly-color-picker space="okhsv" selector="wheel" harmony="triadic"></jolly-color-picker>
```

The value stays a hex string in every space. The picker keeps its own point in
the active space between edits, so hue and saturation survive a trip through
black or gray.

## App-wide defaults

```ts
interface ColorPickerPreferences {
  space: "hsv" | "okhsv"; // default "hsv"
  selector: "square" | "wheel"; // default "square"
  channels: "hsl" | "oklch"; // default "hsl"
  harmony: ColorPickerHarmony; // default "none"
  discrete: boolean; // default false
}

interface ColorPickerPreferenceSource {
  values(): Readonly<ColorPickerPreferences>;
  update(patch: Partial<ColorPickerPreferences>): void;
  watch(listener: () => void): () => void; // returns the unwatch function
}

class ColorPicker {
  static configure(patch: Partial<ColorPickerPreferences>): void;
  static follow(source: ColorPickerPreferenceSource): () => void;
}
```

Every picker on the page reads one shared set of preferences. A property left
unset on a picker follows it; a property set on a picker wins, including inside
`jolly-color` rows. `configure()` writes a patch to the shared set and
re-renders every connected picker.

Until an application calls `follow()`, the shared set lives in memory and
starts from `COLOR_PICKER_DEFAULTS`. `follow()` hands it to the application's
own store: pickers then read `values()`, `configure()` calls `update()`, and a
`watch()` notification re-renders them. The returned function goes back to the
in-memory set. A second `follow()` replaces the first.

```ts
const release = ColorPicker.follow({
  values: () => store.read("color-picker"),
  update: (patch) => store.write("color-picker", patch),
  watch: (listener) => store.subscribe("color-picker", listener)
});
```

### Options and defaults

```ts
interface ColorPickerOption<TValue extends string> {
  value: TValue;
  label: string;
}

type ColorPickerChoice = "space" | "selector" | "channels" | "harmony";

const COLOR_PICKER_DEFAULTS: Readonly<ColorPickerPreferences>;
const COLOR_PICKER_OPTIONS: {
  readonly [TKey in ColorPickerChoice]: readonly ColorPickerOption<
    ColorPickerPreferences[TKey]
  >[];
};
```

The settings button lists `COLOR_PICKER_OPTIONS`. A settings page that edits
the same preferences should build its fields from them too, so both list the
same values under the same labels. `@jolly-pixel/ui/color-picker` exports both
constants and the preference types without loading any element, for code that
runs where there is no DOM.

## Settings button

`settings` adds a button at the end of the footer. It swaps the harmony row
(stack) or the channel fields (wide) for selects that edit the shared
preferences: space, selector, channels, harmony and the discrete wheel. Each
change sends only the edited key to `configure()`. A property set on the
picker still wins over what the settings choose.

```html
<jolly-color-picker layout="wide" alpha settings></jolly-color-picker>
```

## Channel fields

- Accept numeric expressions, commit on Enter or blur, and clamp to their
  range: 0 to 255 for RGB, 0 to 360 for H, 0 to 100 for S, L and A. OKLCH L
  is a percentage, C runs from 0 to 0.4 and is gamut mapped into sRGB, and H
  uses degrees.
- Escape discards the draft. An unparsable entry sets `aria-invalid`.
- Hue and saturation survive edits that reach black or grey.
