# Types and conversion

## `RGBA` and `RGBA8`

```ts
interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface RGBA8 {
  r: number;
  g: number;
  b: number;
  a: number;
}
```

`RGBA` uses channels from 0 to 1 and is the input or output type for most APIs.
`RGBA8` uses channels from 0 to 255 for byte-based storage such as
`ImageData`. The two types do not assign to each other.

### `toRGBA8()` and `fromRGBA8()`

```ts
function toRGBA8(color: RGBA): RGBA8
function fromRGBA8(color: RGBA8): RGBA
```

`toRGBA8` rounds and clamps each channel, while `fromRGBA8` divides each
channel by 255 without clamping.

```ts
import { fromRGBA8, toRGBA8 } from "@jolly-pixel/color";

toRGBA8({ r: 1.5, g: 0.5, b: -0.2, a: 1 });
// { r: 255, g: 128, b: 0, a: 255 }

fromRGBA8({ r: 255, g: 128, b: 0, a: 255 });
// { r: 1, g: 0.502…, b: 0, a: 1 }
```

Byte-based code can skip the round trip: [`assertColor8`](./parse.md) parses
straight to `RGBA8`, and [`formatHex8`, `formatRgb8` and
`formatRgba8`](./format.md) read it.

## `ColorInput` and `ColorInput8`

```ts
type ColorInput = string | RGBA;
type ColorInput8 = string | RGBA8;
```

APIs that accept either type parse strings and use color objects directly.

## `ColorSpace`

```ts
type HueColor<TChannel extends string> = Record<TChannel | "h" | "a", number>;
type ColorSpaceName = "hsv" | "okhsv" | "hsl" | "okhsl" | "hwb" | "oklch";

class ColorSpace<TChannel extends string> {
  static readonly hsv: ColorSpace<"s" | "v">;
  static readonly okhsv: ColorSpace<"s" | "v">;
  static readonly hsl: ColorSpace<"s" | "l">;
  static readonly okhsl: ColorSpace<"s" | "l">;
  static readonly hwb: ColorSpace<"w" | "b">;
  static readonly oklch: ColorSpace<"l" | "c">;

  static named(name: ColorSpaceName): ColorSpace;

  readonly name: string;

  toRgb(color: HueColor<TChannel>): RGBA;
  fromRgb(color: RGBA, previous?: Partial<HueColor<TChannel>>): HueColor<TChannel>;
  mix(from: RGBA, to: RGBA, amount: number, hue?: HueInterpolation): RGBA;
}
```

One object per hue-based color model. Hue uses degrees and wraps. Every other
channel uses 0 to 1 and is clamped, except OKLCH chroma.

```ts
import { ColorSpace } from "@jolly-pixel/color";

const orange = ColorSpace.hsl.fromRgb({ r: 1, g: 0.4, b: 0, a: 1 });
// { h: 24, s: 1, l: 0.5, a: 1 }

ColorSpace.hsl.toRgb({ ...orange, l: 0.25 });
```

### `fromRgb()`

Converts an `RGBA` color. Without `previous`, grays get hue 0 and black gets
saturation 0.

With `previous`, channels that the color does not define take their value
from `previous`. Only the channels present in `previous` are carried:

- `hsv`, `okhsv`: hue when `s` or `v` is 0, saturation when `v` is 0.
- `hsl`, `okhsl`: hue when `s` is 0 or at black and white, saturation at
  black and white.
- `hwb`: hue when `w + b >= 1`.
- `oklch`: hue when `c` is 0.

```ts
const previous = { h: 140, s: 0.7, v: 0.5, a: 1 };

ColorSpace.hsv.fromRgb({ r: 0, g: 0, b: 0, a: 1 }, previous);
// { h: 140, s: 0.7, v: 0, a: 1 }
```

A picker passes its current point, so dragging through gray or black keeps
the hue and saturation it had.

### `mix()`

Same as [`mixColor`](./mix.md) with this space. `ColorSpace.named(name)`
returns the space for a `MixSpace` or preference string.

### HSV, HSL and HWB

When `w + b >= 1`, HWB returns the gray described by the whiteness and
blackness channels.

### OKLCH

The polar form of OKLab, the perceptual model behind CSS `oklch()`. Lightness
runs from 0 to 1, chroma from 0 to about 0.37 inside sRGB. Equal steps in
lightness or hue look like equal changes, which HSL and HSV do not promise.
Values still describe sRGB colors: OKLCH is a space to pick and blend in.

`toRgb` clamps lightness and alpha, and maps a color outside sRGB back inside
with the CSS Color 4 algorithm: chroma drops at constant lightness and hue
until clipping is no longer noticeable. Lightness 0 and 1 return black and
white.

```ts
ColorSpace.oklch.fromRgb({ r: 1, g: 0, b: 0, a: 1 });
// { l: 0.628, c: 0.258, h: 29.23, a: 1 }
```

### OKHSV and OKHSL

Björn Ottosson's OKHSV and OKHSL reshape OKLab so that saturation 1 always
reaches the sRGB gamut edge. A square or wheel drawn in these models has no
holes, unlike a raw OKLCH plane. Hue matches OKLCH hue. Lightness follows a
perceptual toe curve, so OKHSL `l: 0.5` looks like a middle gray.

A round trip can drift by about 0.001 near the gamut edge, under one 8-bit
step.

## `HSVA`, `HSLA`, `HWBA`, `OKLCHA`, `OKHSVA` and `OKHSLA`

```ts
interface HSVA { h: number; s: number; v: number; a: number }
interface HSLA { h: number; s: number; l: number; a: number }
interface HWBA { h: number; w: number; b: number; a: number }
interface OKLCHA { l: number; c: number; h: number; a: number }
interface OKHSVA { h: number; s: number; v: number; a: number }
interface OKHSLA { h: number; s: number; l: number; a: number }
```

Named shapes of the `HueColor` each `ColorSpace` reads and returns.

## `hsvToHsl()` and `hslToHsv()`

```ts
function hsvToHsl(color: HSVA): HSLA
function hslToHsv(color: HSLA): HSVA
```

These convert between the two models directly, without an RGB round trip, so
hue passes through (wrapped) on grays. Saturation, value, lightness and alpha
are clamped.

At the black point, where HSL saturation is undefined, both functions return
the limit as lightness approaches 0 at the same HSV saturation:
`hsvToHsl` gives `s / (2 - s)` and `hslToHsv` gives `2s / (1 + s)`. A color
converted to black and back keeps its saturation. At white, HSL saturation is
0.

```ts
import { hslToHsv, hsvToHsl } from "@jolly-pixel/color";

hslToHsv(hsvToHsl({ h: 24, s: 1, v: 0, a: 1 }));
// { h: 24, s: 1, v: 0, a: 1 }
```

## `isOklchInGamut()`

```ts
function isOklchInGamut(color: OKLCHA): boolean
```

Returns whether the color fits in sRGB before gamut mapping.

## sRGB transfer functions

```ts
function srgbToLinear(channel: number): number
function linearToSrgb(channel: number): number
```

These functions convert a single channel between gamma-encoded sRGB and linear
light; averaging or blending should use the linear-light value.

```ts
import { linearToSrgb, srgbToLinear } from "@jolly-pixel/color";

const linear = srgbToLinear(0.5);
linearToSrgb(linear);  // 0.5
```
