# Monitor formatting functions

The root package exports these formatters:

| Function | Output |
|---|---|
| `formatInteger(value)` | Rounded integer, no grouping |
| `formatCount(value)` | Rounded count with `en-US` grouping |
| `formatDecimal(value, decimals?)` | Fixed-point number, one decimal by default |
| `formatMilliseconds(value)` | Millisecond text |
| `formatPercent(value)` | Percentage text |
| `formatBytes(value)` | Byte size in binary steps (`B`, `KiB`, `MiB`, ...) |
| `formatVector(value, precision?)` | Comma-joined axes, two decimals by default |

Pass a formatter to `jolly-monitor`, `jolly-graph`, or facade monitor options.
