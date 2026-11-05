# Color

An immutable unit sRGB color. It implements [`RGBA`](./convert.md#rgba-and-rgba8),
so it can be passed anywhere an `RGBA` is expected, and spreading it gives a
plain `RGBA`.

```ts
import { Color } from "@jolly-pixel/color";

const orange = Color.from("hsl(24 100% 50%)");

orange.hex();                      // "#ff6600"
orange.withAlpha(0.5).rgba();      // "rgba(255, 102, 0, 0.5)"
orange.ink().hex();                // "#000000"
Color.fromBytes(pixel).toBytes();  // pixel
```

```ts
class Color implements RGBA {
  static readonly black: Color;
  static readonly white: Color;

  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;

  constructor(color: RGBA);
}
```

The constructor copies the channels as given. Methods that write a string or
bytes clamp them.

## Creating a color

### `Color.parse(input: string): Color | null`

Parses a supported color string, or returns `null` for invalid or incomplete
input, which suits text fields that parse on every keystroke.

- Hex: `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, with an optional hash.
- `rgb()` / `rgba()`: `rgb(255, 102, 0)`, `rgb(255 102 0 / 50%)`, `rgb(100% 40% 0%)`.
- `hsl()` / `hsla()`: comma or space syntax, with `deg`, `rad`, `turn` and `grad` hue units.
- `hsv()` / `hsva()`: a non-standard notation used by HSV color pickers.
- `hwb()`: space syntax only.
- `oklch()` / `oklab()`: space syntax only. Lightness takes 0 to 1 or a
  percentage. Chroma and the `a`/`b` axes take a number, or a percentage where
  `100%` is `0.4`.
- The 148 CSS named colors and `transparent`.

Parsing is case-insensitive and `none` reads as `0`. Channels are clamped and
hues wrap. An `oklch()` or `oklab()` color outside sRGB is brought inside by
lowering its chroma ([gamut mapping](./convert.md#oklch)).

Unknown functions, wrong argument counts, mixed comma and slash separators,
comma-based `hwb()` and CSS Color 4 functions such as `lab()` or
`color-mix()` return `null`.

### `Color.parseDraft(draft: string): Color | null`

Same as `parse`, for text the user may still be typing: four-digit hex such as
`#ff66` returns `null`, since it is more likely a half-typed `#ff6600` than
`#rgba`.

### `Color.from(input: ColorInput): Color`

Accepts a color string or an `RGBA`. A `Color` is returned as is, a plain
`RGBA` is copied, and a string is parsed. Throws `ColorParseError`, whose
message includes the input, when the string does not parse.

### `Color.fromBytes(input: ByteColorInput): Color`

Divides each byte channel by 255, or parses a string like `Color.from`. Use
it to read `ImageData`, palettes, network payloads and options typed
[`ByteColorInput`](./convert.md#colorinput-and-bytecolorinput).

## Deriving colors

### `withAlpha(alpha: number): Color`

Returns the same channels with a new alpha.

### `over(backdrop: RGBA): Color`

Composites this color over `backdrop` (source-over, straight alpha). Over an
opaque backdrop the result is opaque.

### `shadeRamp(options?: ShadeRampOptions): Color[]`

Returns darker shades, this color, then lighter tints. See
[shade ramps](./mix.md#color-shaderamp).

## Contrast

### `contrastWith(other: RGBA): number`

Returns the WCAG contrast ratio, from 1 for equal colors to 21 for black on
white. Order does not matter and alpha is ignored, so composite a translucent
color with `over` first.

```ts
Color.from("#767676").contrastWith(Color.white); // 4.54, the lightest gray that passes AA
```

### `ink(): Color`

Returns `Color.black` or `Color.white`, whichever has the higher contrast
ratio against this color. Alpha is ignored.

- Grays switch from white to black ink between `#757575` and `#767676`.
- Saturated red gets black ink.

## Writing a color

### `toBytes(): RGBA8`

Rounds and clamps each channel to 0..255.

### `hex(withAlpha?: boolean): string`

Writes lowercase six-digit hex, or eight digits when `withAlpha` is `true`.

### `rgb(): string` and `rgba(): string`

Write the legacy comma syntax accepted by canvas `fillStyle`. `rgba()` keeps
alpha to three decimals.

```ts
const translucent = new Color({ r: 1, g: 0.4, b: 0, a: 0.5 });

translucent.rgb();   // "rgb(255, 102, 0)"
translucent.rgba();  // "rgba(255, 102, 0, 0.5)"
```

### `hsl(): string`

Converts to HSL and writes `hsl()`, or `hsla()` when alpha is below 1, with
up to one decimal for hue and percentages.

### `oklch(): string`

Converts to OKLCH and writes lightness as a percentage with two decimals,
chroma with five and hue with two, enough to parse back to the same 8-bit
color. Alpha follows a slash when it is below 1.

```ts
Color.from("#ff6600").withAlpha(0.5).oklch();
// "oklch(69.58% 0.20426 43.49 / 0.5)"
```
