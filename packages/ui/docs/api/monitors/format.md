# Monitor formatting functions

Formatters for `jolly-monitor`, `jolly-graph` and facade monitor options,
exported from the root entry point.

### `formatInteger(value: number): string`

Rounded, no grouping.

### `formatCount(value: number, singular?: string, plural?: string): string`

Rounded with `en-US` grouping. With `singular`, followed by the unit:
`"1 voxel"`, `"12,345 voxels"`. `plural` defaults to `singular` plus `s`.

### `formatDecimal(value: number, decimals?: number): string`

Fixed-point, one decimal by default.

### `formatMilliseconds(value: number): string`

One decimal and ` ms`.

### `formatPercent(value: number): string`

One decimal and ` %`.

### `formatBytes(value: number): string`

Binary steps: `B`, `KiB`, `MiB`, and so on.

### `formatVector(value: Vec2Like | Vec3Like | Vec4Like, precision?: number): string`

Comma-joined axes, two decimals by default.
