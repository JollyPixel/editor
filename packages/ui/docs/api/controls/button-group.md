# `jolly-button-group`

`jolly-button-group` edits one value through a segmented row or grid of
buttons. It implements the [shared field API](../field/shared-field-api.md).

```ts
const field = document.querySelector("jolly-button-group");
field.options = [
  { value: "move", label: "Move" },
  { value: "paint", label: "Paint" }
];
field.value = "move";
```

| Property | Type | Default |
|---|---|---|
| `options` | `JollyOption<T>[]` | `[]` |
| `layout` | `"segmented" \| "grid"` | `"segmented"` |
| `columns` | `number` | `0` |

`columns = 0` lets the grid choose its column count. The group has one tab
stop. Arrow keys move between enabled options. A selection emits
`jolly-change`.
