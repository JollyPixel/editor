# Parsing

Parsing functions return unit sRGB [`RGBA`](./convert.md#rgba-and-rgba8) values.

## `parseColor()`

```ts
function parseColor(input: string): RGBA | null
```

Parses a supported color string. It returns `null` for invalid or incomplete
input, which makes it suitable for text fields that parse on every keystroke.

```ts
import { parseColor } from "@jolly-pixel/color";

parseColor("hsl(210 40% 17%)");
// { r: 0.102, g: 0.17, b: 0.238, a: 1 }

parseColor("#ff6600");
// { r: 1, g: 0.4, b: 0, a: 1 }

parseColor("nope");
// null
```

### Accepted input

| Notation | Examples |
| --- | --- |
| Hex | `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, with an optional hash |
| `rgb()` / `rgba()` | `rgb(255, 102, 0)`, `rgb(255 102 0 / 50%)`, `rgb(100% 40% 0%)` |
| `hsl()` / `hsla()` | Comma or space syntax; `deg`, `rad`, `turn`, and `grad` hue units |
| `hsv()` / `hsva()` | Non-standard notation used by HSV color pickers |
| `hwb()` | Space-separated syntax |
| `oklch()` / `oklab()` | `oklch(62.8% 0.258 29.2)`, `oklab(0.628 0.225 0.126 / 50%)` |
| Named | The 148 CSS named colors and `transparent` |

Parsing is case-insensitive. Whitespace follows the supported CSS syntax, and
`none` is parsed as `0`. Channels are clamped to their valid range, while hue
values wrap:

```ts
parseColor("rgb(300 0 -20)");
// { r: 1, g: 0, b: 0, a: 1 }

parseColor("hsl(-150 40% 17%)");
// Same result as hsl(210 40% 17%)
```

`oklch()` and `oklab()` accept only the space syntax. Lightness takes a number
from 0 to 1 or a percentage; chroma and the `a`/`b` axes take a number or a
percentage where `100%` is `0.4`. A color outside sRGB is brought inside with
the CSS Color 4 gamut mapping: chroma drops until the clipped color is within
a just noticeable difference, so lightness and hue barely move.

```ts
parseColor("oklch(0.7 0.4 150)");
// a green inside sRGB, with less chroma than requested
```

Unknown functions and names return `null`. The parser also rejects invalid
argument counts, mixed comma-and-slash separators, comma-based `hwb()`, and
unsupported CSS Color 4 functions such as `lab()` or `color-mix()`.

> [!NOTE]
> Four-digit hex such as `#ff66` is valid. A text field may still reject it
> while the user is typing a longer value such as `#ff6600`. JollyPixel's UI
> applies that field-specific rule in `parseFieldColor()`.

## `assertColor()`

```ts
function assertColor(input: ColorInput): RGBA
```

Accepts a supported color string or an existing `RGBA`. Strings are parsed and
invalid values throw `ColorParseError`; an `RGBA` object is returned unchanged.

```ts
import { assertColor } from "@jolly-pixel/color";

assertColor("#f60");
// { r: 1, g: 0.4, b: 0, a: 1 }

assertColor({ r: 1, g: 0, b: 0, a: 1 });
// { r: 1, g: 0, b: 0, a: 1 }

assertColor("nope");
// throws ColorParseError
```

## `assertColor8()`

```ts
function assertColor8(input: ColorInput8): RGBA8
```

Same as `assertColor`, for byte channels: strings are parsed, then rounded and
clamped to 0..255; an `RGBA8` object is returned unchanged.

```ts
import { assertColor8 } from "@jolly-pixel/color";

assertColor8("#ff000080");
// { r: 255, g: 0, b: 0, a: 128 }
```

## `ColorParseError`

`ColorParseError` extends `Error`. Its message includes the string that could
not be parsed.
