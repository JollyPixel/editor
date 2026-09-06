# Monitor formatting functions

The root package exports four numeric formatters:

| Function | Output |
|---|---|
| `formatCount(value)` | Rounded count |
| `formatDecimal(value, decimals?)` | Fixed-point number, one decimal by default |
| `formatMilliseconds(value)` | Millisecond text |
| `formatPercent(value)` | Percentage text |

Pass a formatter to `jolly-monitor`, `jolly-graph`, or facade monitor options.
