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

## Properties

```ts
interface Select<T> {
  options: JollyOption<T>[]; // property only
}
```

- Options are matched by position, so values may be strings, numbers or
  objects. An option can carry an `icon`.
- A user selection emits `jolly-change`.
