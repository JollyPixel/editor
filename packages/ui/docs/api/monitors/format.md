# Monitor formatting functions

The root package exports these formatters:

| Function | Output |
|---|---|
| `formatInteger(value)` | Rounded integer, no grouping |
| `formatCount(value, singular?, plural?)` | Rounded count with `en-US` grouping; with `singular`, followed by the unit (`"1 voxel"`, `"12,345 voxels"`), `plural` defaulting to `singular` plus `s` |
| `formatDecimal(value, decimals?)` | Fixed-point number, one decimal by default |
| `formatMilliseconds(value)` | Millisecond text |
| `formatPercent(value)` | Percentage text |
| `formatBytes(value)` | Byte size in binary steps (`B`, `KiB`, `MiB`, ...) |
| `formatVector(value, precision?)` | Comma-joined axes, two decimals by default |

Pass a formatter to `jolly-monitor`, `jolly-graph`, or facade monitor options.
