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
`ImageData`.

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

## `ColorInput`

```ts
type ColorInput = string | RGBA;
```

APIs that accept `ColorInput` parse strings and use `RGBA` values directly.

## `HSVA`, `HSLA`, and `HWBA`

```ts
interface HSVA {
  h: number;
  s: number;
  v: number;
  a: number;
}

interface HSLA {
  h: number;
  s: number;
  l: number;
  a: number;
}

interface HWBA {
  h: number;
  w: number;
  b: number;
  a: number;
}
```

Hue uses degrees. Every other channel uses a value from 0 to 1.

### HSV

```ts
function rgbToHsv(color: RGBA): HSVA
function hsvToRgb(color: HSVA): RGBA
```

### HSL

```ts
function rgbToHsl(color: RGBA): HSLA
function hslToRgb(color: HSLA): RGBA
```

### HWB

```ts
function rgbToHwb(color: RGBA): HWBA
function hwbToRgb(color: HWBA): RGBA
```

RGB inputs and non-hue cylindrical channels are clamped. Hue values wrap;
achromatic RGB colors convert with both hue and saturation set to 0.

```ts
import {
  hslToRgb,
  hsvToRgb,
  hwbToRgb,
  rgbToHsl,
  rgbToHsv,
  rgbToHwb
} from "@jolly-pixel/color";

hslToRgb({ h: -360, s: 2, l: 0.5, a: 2 });
// Same result as { h: 0, s: 1, l: 0.5, a: 1 }
```

When `w + b >= 1`, `hwbToRgb` returns the gray described by the whiteness and
blackness channels.

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

## Pixel buffers

### `imageDataToPixels()`

```ts
function imageDataToPixels(data: Uint8ClampedArray): RGBA8[]
```

Copies an `ImageData` byte buffer into an array of `RGBA8` objects.

### `pixelsToImageData()`

```ts
function pixelsToImageData(
  pixels: readonly RGBA8[],
  data: Uint8ClampedArray,
  mask?: readonly boolean[]
): void
```

Writes pixels into `data` in place. When a mask entry is `false`, the function
writes the RGB channels and sets alpha to 0.

```ts
import { imageDataToPixels, pixelsToImageData } from "@jolly-pixel/color";

const pixels = imageDataToPixels(imageData.data);
pixelsToImageData(pixels, imageData.data, mask);
```
