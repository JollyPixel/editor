# Mixing and harmonies

## `Gradient`

```ts
type MixSpace = "srgb" | "linear" | "oklab" | ColorSpaceName;
type HueInterpolation = "shorter" | "longer" | "increasing" | "decreasing";

interface MixOptions {
  space?: MixSpace; // default "oklab"
  hue?: HueInterpolation; // default "shorter", used by hue-based spaces
}

class Gradient {
  static between(from: RGBA, to: RGBA, options?: MixOptions): Gradient;
}
```

A blend from one color to another in one space. `between` converts both ends
once, so reading many points costs one conversion back each. Alpha is
interpolated linearly in every space.

- `"srgb"` averages the encoded channels, the way most paint programs blend.
- `"linear"` averages light, so black and white meet at `#bcbcbc`.
- `"oklab"` averages perceptually: black and white meet at `#636363`, a gray
  that looks halfway.
- A [`ColorSpace`](./convert.md#colorspace) name interpolates each channel
  of that model. `"oklch"` keeps colors vivid through the middle. `hue` picks
  the arc with the CSS hue interpolation methods. When one end is a gray, the
  other end's hue is used, so a gray to cyan blend never passes through red.
  Only hue is carried, like CSS `color-mix()`.

```ts
import { Gradient } from "@jolly-pixel/color";

Gradient.between(gray, cyan, { space: "oklch" }).at(0.5);
Gradient.between(red, blue, { space: "oklch", hue: "longer" }).at(0.5);
```

### `at(amount: number): Color`

Returns the [`Color`](./Color.md) `amount` of the way along. `amount` is
clamped to 0..1.

### `steps(count: number): Color[]`

Returns `count` evenly spaced colors, both ends included. Throws a
`RangeError` when `count` is not an integer of at least 2.

```ts
Gradient.between(black, white, { space: "srgb" })
  .steps(5)
  .map((color) => color.hex());
// ["#000000", "#404040", "#808080", "#bfbfbf", "#ffffff"]
```

## `Color.shadeRamp()`

```ts
interface ShadeRampOptions {
  shades?: number; // default 3
  tints?: number; // default 3
  hueShift?: number; // degrees, default 20
}

class Color {
  shadeRamp(options?: ShadeRampOptions): Color[];
}
```

Returns `shades` darker colors, the color itself, then `tints` lighter
colors, from dark to light. It works in OKLCH:

- Lightness moves evenly toward black and white without reaching them.
- Shades turn their hue toward blue (265°) and tints toward yellow (85°). The
  turn grows up to `hueShift` at the ends and never passes the target hue.
- Chroma drops by up to 40% toward both ends. Out of gamut colors are mapped
  like `ColorSpace.oklch.toRgb`, which can move hue a few degrees.
- Grays stay gray, and alpha is kept.

Throws a `RangeError` when `shades` or `tints` is not a non-negative integer.

## `colorHarmony()`

```ts
const HARMONY_KINDS: readonly [
  "complementary",
  "monochromatic",
  "analogous",
  "split-complementary",
  "triadic",
  "tetradic",
  "square"
];
type HarmonyKind = typeof HARMONY_KINDS[number];

function colorHarmony<T extends HSVA>(color: T, kind: HarmonyKind): T[]
```

Returns the base color first, then its harmony. Every kind except
`"monochromatic"` rotates the hue and keeps saturation, value and alpha:

- `"complementary"`: 180°
- `"analogous"`: -30° and 30°
- `"split-complementary"`: 150° and 210°
- `"triadic"`: 120° and 240°
- `"tetradic"`: 60°, 180° and 240°
- `"square"`: 90°, 180° and 270°

`"monochromatic"` keeps the hue and returns a shade at half the value and a
tint at half the saturation.

The function works on any hue, saturation and value model, so it accepts both
`HSVA` and `OKHSVA`. An `OKHSVA` harmony is perceptually spaced and stays in
gamut at any rotation.

```ts
import { colorHarmony, ColorSpace } from "@jolly-pixel/color";

const { okhsv } = ColorSpace;
colorHarmony(okhsv.fromRgb(base), "triadic").map((color) => okhsv.toRgb(color));
```
