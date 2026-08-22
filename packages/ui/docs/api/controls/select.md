# `jolly-select`

`jolly-select` edits one value through a native select. It implements the
[shared field API](../field/shared-field-api.md).

```ts
const field = document.querySelector("jolly-select");
field.options = [
  { value: "nearest", label: "Nearest" },
  { value: "linear", label: "Linear", disabled: true }
];
field.value = "nearest";
```

| Property | Type | Default |
|---|---|---|
| `options` | `JollyOption<T>[]` | `[]` |

Options are matched by position, so their values may be strings, numbers, or
objects. Options can include an `IconName`. A user selection emits
`jolly-change`.
