# Contrast

## `contrastingColor()`

```ts
function contrastingColor(input: ColorInput): "#000" | "#fff"
```

Accepts a supported color string or an `RGBA`, then returns the ink, black or
white, with the higher WCAG contrast ratio against it. Alpha does not affect
the result. An unparseable string throws `ColorParseError`.

```ts
import { contrastingColor } from "@jolly-pixel/color";

contrastingColor("#ffffff");  // "#000"
contrastingColor("#ff0000");  // "#000"
contrastingColor("#277da1");  // "#fff"
```

- Grays switch from white to black ink between `#757575` and `#767676`.
- Use it for editor outlines, casings and labels drawn over a user color.
