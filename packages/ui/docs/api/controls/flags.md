# `jolly-flags`

`jolly-flags` edits an unsigned 32-bit bitmask. It implements the
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

## Properties

```ts
interface Flags {
  options: JollyOption<number>[]; // property only, one bit per value
}
```

- Each option has its own tab stop.
- Toggling an option emits `jolly-change` with the complete mask.
- For many unnamed bits, use [`jolly-layer-grid`](./layer-grid.md).
