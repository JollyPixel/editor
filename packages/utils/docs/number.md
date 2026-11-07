# Numbers

## `clamp()`

```ts
function clamp(value: number, min: number, max: number): number;
```

`value` limited to `[min, max]`. When `min > max`, the result is `max`.

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
