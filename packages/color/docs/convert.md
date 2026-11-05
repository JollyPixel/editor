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

[`Color.fromBytes`](./Color.md) and
[`toBytes`](./Color.md) convert between the two.

### `isRGBA8()`

```ts
function isRGBA8(value: unknown): value is RGBA8
```

Returns `true` when `value` is an object whose `r`, `g`, `b` and `a` are
integers from 0 to 255. Use it to check untrusted data, such as a parsed file,
before treating it as `RGBA8`.

### `equalRGBA8()`

```ts
function equalRGBA8(left: RGBA8, right: RGBA8): boolean
```

Returns `true` when all four byte channels match. It allocates nothing, so
pixel loops can call it per pixel.

## `ColorInput` and `ByteColorInput`

```ts
type ColorInput = string | RGBA;
type ByteColorInput = string | RGBA8;
```

What [`Color.from`](./Color.md) and `Color.fromBytes` accept. A string has no
channel scale, so it parses the same way in both.

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
  readonly channels: readonly TChannel[];

  toRgb(color: HueColor<TChannel>): RGBA;
  fromRgb(color: RGBA, previous?: Partial<HueColor<TChannel>>): HueColor<TChannel>;
}
```

One object per hue-based color model. `channels` lists every channel except
hue and alpha, such as `["s", "l"]` for HSL. Hue uses degrees and wraps. Every
other channel uses 0 to 1 and is clamped, except OKLCH chroma.
`ColorSpace.named(name)` returns the space for a preference string. To blend in
a space, use a [`Gradient`](./mix.md#gradient).

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

## `HueSpace`

```ts
type HueSpaceName = "hsv" | "okhsv" | "okhsl";
type HueLevel = "value" | "lightness";

class HueSpace {
  static readonly hsv: HueSpace;
  static readonly okhsv: HueSpace;
  static readonly okhsl: HueSpace;
  static named(name: HueSpaceName): HueSpace;

  readonly name: HueSpaceName;
  readonly level: HueLevel;
  readonly pureLevel: number;

  toRgb(point: HSVA): RGBA;
  fromRgb(color: RGBA, previous?: HSVA): HSVA;
  pureHue(point: HSVA): RGBA;
  convert(point: HSVA, target: HueSpace): HSVA;
  read<TChannel>(point: HSVA, space: ColorSpace<TChannel>): HueColor<TChannel>;
  write<TChannel>(point: HSVA, space: ColorSpace<TChannel>, channel: TChannel | "h", value: number): HSVA;
}
```

The hue, saturation and level model a color picker moves through. Every point
is an `HSVA` whose `v` is the level: value for `hsv` and `okhsv`,
lightness for `okhsl` (`level` says which).

- `pureLevel` is the level where full saturation gives the pure hue: 1 for
  value, 0.5 for lightness. `pureHue` returns that color.
- `fromRgb` and `convert` carry hue and saturation from the previous point
  on grays and black, like [`ColorSpace.fromRgb`](#fromrgb).
- `read` returns the point in another `ColorSpace` and `write` changes one
  of its channels. A space that shares the hue axis (`hsl` for `hsv`,
  `oklch` for `okhsv` and `okhsl`) takes hue straight from the point, so a
  gray keeps it.
- HSL from an `hsv` point skips RGB. At black, where HSL saturation is
  undefined, it uses the limit as lightness reaches 0, so a color written to
  black and back keeps its saturation.

```ts
import { ColorSpace, HueSpace } from "@jolly-pixel/color";

const point = { h: 24, s: 1, v: 1, a: 1 };
HueSpace.hsv.read(point, ColorSpace.hsl);        // { h: 24, s: 1, l: 0.5, a: 1 }
HueSpace.hsv.write(point, ColorSpace.hsl, "l", 0.25);
```
