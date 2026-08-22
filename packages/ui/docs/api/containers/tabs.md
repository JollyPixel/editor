# `jolly-tabs`

`jolly-tabs` renders direct `jolly-tab` children as an accessible tab set.

```html
<jolly-tabs value="build">
  <jolly-tab value="build" label="Build">Build settings</jolly-tab>
  <jolly-tab value="paint" label="Paint">Paint settings</jolly-tab>
</jolly-tabs>
```

| Property | Type | Default |
|---|---|---|
| `value` | `string` | `""` |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` |

An absent, disabled, or unknown value selects the first enabled tab. User
selection emits `jolly-tab-change` with `{ value }`. Home, End, and the arrow
keys move between enabled tabs according to orientation.
