# `jolly-flags`

`jolly-flags` edits an unsigned 32-bit bitmask and implements the
[shared field API](../field/shared-field-api.md).

```ts
const field = document.querySelector("jolly-flags");
field.options = [
  { value: 1, label: "Default" },
  { value: 2, label: "Player" },
  { value: 4, label: "Terrain" }
];
field.value = 5;
```

| Property | Type | Default |
|---|---|---|
| `options` | `JollyOption<number>[]` | `[]` |

Each option value must contain one bit. Each option has its own tab stop.
Toggling an option emits `jolly-change` with the complete mask.
