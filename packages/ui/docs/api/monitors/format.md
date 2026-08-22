# Monitor formatting functions

The root package exports three numeric formatters:

| Function | Output |
|---|---|
| `formatCount(value)` | Rounded count |
| `formatMilliseconds(value)` | Millisecond text |
| `formatPercent(value)` | Percentage text |

Pass a formatter to `jolly-monitor`, `jolly-graph`, or facade monitor options.
