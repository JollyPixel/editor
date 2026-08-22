# Color utilities

```ts
import {
  formatHex,
  parseColor
} from "@jolly-pixel/ui";

const rgba = parseColor("#ff660080");
const hex = rgba === null ? null : formatHex(rgba, true);
```

`parseColor(input)` accepts three-digit, six-digit, and eight-digit hex forms
and returns `RGBA` or `null`. Four-digit shorthand is rejected. `RGBA` has
numeric `r`, `g`, `b`, and `a` channels. `formatHex(value, alpha?)` returns
normalized lowercase hex text.
