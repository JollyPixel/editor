# Numbers

## `clamp()`

```ts
function clamp(value: number, min: number, max: number): number;
```

`value` limited to `[min, max]`. When `min > max`, the result is `max`.

## `wrap()`

```ts
function wrap(value: number, length: number): number;
```

`value` wrapped into `[0, length)`. Unlike `%`, a negative `value` lands at the
end of the range, which suits cyclic indices and angles.

```ts
import { wrap } from "@jolly-pixel/utils";

wrap(-1, 4);     // 3
wrap(-90, 360);  // 270
```

## `roundTo()`

```ts
function roundTo(value: number, decimals: number): number;
```

`value` rounded to `decimals` digits after the point, with ties rounded away
from zero, so `roundTo(-x, d)` is always `-roundTo(x, d)`. It never returns
`-0`, so a rounded value compares and serializes like `0`.

```ts
import { roundTo } from "@jolly-pixel/utils";

roundTo(0.1 + 0.2, 6);  // 0.3
roundTo(-0.125, 2);     // -0.13
roundTo(-0.0001, 2);    // 0
```

## `formatBytes()`

```ts
function formatBytes(bytes: number): string;
```

A byte count in binary steps of 1024: `B`, `KiB`, `MiB`, `GiB`, `TiB`. Bytes
are rounded to a whole number; larger units keep at most one decimal and drop
a trailing `.0`.

```ts
import { formatBytes } from "@jolly-pixel/utils";

formatBytes(1023.4);            // "1023 B"
formatBytes(1536);              // "1.5 KiB"
formatBytes(12 * 1024 * 1024);  // "12 MiB"
```
