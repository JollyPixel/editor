# `jolly-range`

`jolly-range` edits an `Interval` with `from` and `to` endpoints. It
implements the [shared field API](../field/shared-field-api.md).

```ts
const field = document.querySelector("jolly-range");
field.value = { from: 10, to: 30 };
```

## Properties

```ts
interface Range {
  step: number; // default 1
  min: number; // default 0
  max: number; // default 100
  value: Interval | typeof Mixed; // default { from: 0, to: 100 }
}
```

- Endpoints cannot cross. A commit is quantized to `step`, clamped to the
  bounds, then clamped against the other endpoint.
- Enter, blur and arrow-key steps emit `jolly-change`.
- Escape discards the focused endpoint's draft.
- A parse error on either endpoint shows as the field error.
