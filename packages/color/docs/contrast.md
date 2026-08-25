# Contrast

## `contrastingColor()`

```ts
function contrastingColor(input: ColorInput): string
```

Accepts a supported color string or an `RGBA`, then returns black or white using
the editor's BT.601 brightness threshold. Alpha does not affect the result.
An unparseable string throws `ColorParseError`.

```ts
import { contrastingColor } from "@jolly-pixel/color";

contrastingColor("#ffffff");
// "#000"

contrastingColor("#277da1");
// "#fff"

contrastingColor({ r: 1, g: 1, b: 1, a: 1 });
// "#000"
```

Use this function for editor outlines and overlays. It does not select a color
by WCAG contrast ratio.

## `relativeLuminance()`

```ts
function relativeLuminance(color: RGBA): number
```

Returns WCAG relative luminance from 0 for black to 1 for white. Alpha is
ignored.

```ts
import { relativeLuminance } from "@jolly-pixel/color";

relativeLuminance({ r: 0, g: 0, b: 0, a: 1 });  // 0
relativeLuminance({ r: 1, g: 1, b: 1, a: 1 });  // 1
```

## `contrastRatio()`

```ts
function contrastRatio(a: RGBA, b: RGBA): number
```

Returns the WCAG contrast ratio from 1 to 21. Alpha and argument order do not
affect the result.

```ts
import { contrastRatio } from "@jolly-pixel/color";

const black = { r: 0, g: 0, b: 0, a: 1 };
const white = { r: 1, g: 1, b: 1, a: 1 };

contrastRatio(black, white);  // 21
contrastRatio(white, white);  // 1
```
