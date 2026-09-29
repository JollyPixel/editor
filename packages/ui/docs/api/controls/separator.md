# `jolly-separator`

`jolly-separator` draws a divider between control groups.

```html
<jolly-separator></jolly-separator>
<jolly-separator label="Rendering"></jolly-separator>
```

| Property | Type | Default |
|---|---|---|
| `label` | `string` | `""` |

A label adds a visible caption and accessible name. An empty label produces a
plain separator.

## Trailing actions

Elements assigned to the `actions` slot sit after the rule, on the same row,
without changing the separator's height.

```html
<jolly-separator label="Layer">
  <jolly-button
    slot="actions"
    icon="transform"
    icon-only
    label="Transform"
  ></jolly-button>
</jolly-separator>
```

Actions are siblings of the `separator` role, so assistive technology reaches
them. Slotted buttons keep their regular control colors.
