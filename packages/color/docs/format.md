# Formatting

Formatters clamp channels to their valid range and return CSS color strings.

## `formatHex()` and `formatHex8()`

```ts
function formatHex(color: RGBA, withAlpha?: boolean): string
function formatHex8(color: RGBA8, withAlpha?: boolean): string
```

Use `formatHex` with unit channels and `formatHex8` with byte channels. Pass
`true` to include alpha. Output is lowercase and always uses full-length hex.

```ts
import { formatHex, formatHex8 } from "@jolly-pixel/color";

const orange = { r: 1, g: 0.4, b: 0, a: 0.5 };

formatHex(orange);        // "#ff6600"
formatHex(orange, true);  // "#ff660080"

formatHex8({ r: 255, g: 102, b: 0, a: 255 });
// "#ff6600"
```

## `formatRgb()` and `formatRgba()`

```ts
function formatRgb(color: RGBA): string
function formatRgba(color: RGBA): string
```

`formatRgb` omits alpha. `formatRgba` includes alpha with up to three decimal
places.

```ts
import { formatRgb, formatRgba } from "@jolly-pixel/color";

const orange = { r: 1, g: 0.4, b: 0, a: 0.5 };

formatRgb(orange);   // "rgb(255, 102, 0)"
formatRgba(orange);  // "rgba(255, 102, 0, 0.5)"
```

## `formatHsl()`

```ts
function formatHsl(color: HSLA): string
```

Hue uses degrees. Saturation, lightness, and alpha use channels from 0 to 1.
The function returns `hsla()` when alpha is below 1.

```ts
import { formatHsl } from "@jolly-pixel/color";

formatHsl({ h: 210, s: 0.4, l: 0.17, a: 1 });
// "hsl(210, 40%, 17%)"

formatHsl({ h: 210, s: 0.4, l: 0.17, a: 0.5 });
// "hsla(210, 40%, 17%, 0.5)"
```

Hue and percentages use up to one decimal place. All CSS functions use the
legacy comma syntax accepted by canvas `fillStyle`.
