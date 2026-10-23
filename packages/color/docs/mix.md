# Mixing and harmonies

## `mixColor()`

```ts
type MixSpace = "srgb" | "linear" | "oklab" | ColorSpaceName;
type HueInterpolation = "shorter" | "longer" | "increasing" | "decreasing";

interface MixOptions {
  space?: MixSpace; // default "oklab"
  hue?: HueInterpolation; // default "shorter", used by hue-based spaces
}

function mixColor(
  from: RGBA,
  to: RGBA,
  amount: number,
  options?: MixOptions
): RGBA
```

Returns the color `amount` of the way from `from` to `to`. `amount` is clamped
to 0..1, and alpha is interpolated linearly in every space.

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
import { mixColor } from "@jolly-pixel/color";

mixColor(gray, cyan, 0.5, { space: "oklch" });
mixColor(red, blue, 0.5, { space: "oklch", hue: "longer" });
```

## `colorRamp()`

```ts
function colorRamp(
  from: RGBA,
  to: RGBA,
  count: number,
  options?: MixOptions
): RGBA[]
```

Returns `count` evenly spaced colors from `from` to `to`, both included.
Throws a `RangeError` when `count` is not an integer of at least 2.

```ts
import { colorRamp, formatHex } from "@jolly-pixel/color";

colorRamp(black, white, 5, { space: "srgb" }).map((color) => formatHex(color));
// ["#000000", "#404040", "#808080", "#bfbfbf", "#ffffff"]
```

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
