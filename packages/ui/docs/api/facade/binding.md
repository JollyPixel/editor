# Binding facade

`addBinding(object, key, options?)` creates a field for `object[key]` and
returns its builder.

```ts
interface BindingOptions<TValue> {
  label?: string;
  align?: "start" | "end";
  min?: number;
  max?: number;
  step?: number;
  options?: Record<string, TValue>;
}
```

`label` defaults to the property key. `align` defaults to `"end"` for a
checkbox and `"start"` for every other field.

## Control selection

The initial property value and the options determine the element:

| Value or option | Element |
|---|---|
| `options` is present | `jolly-select` |
| Boolean | `jolly-checkbox` |
| Number with both `min` and `max` | `jolly-slider` |
| Other number | `jolly-number` |
| Six-digit or eight-digit hex string | `jolly-color` |
| Other string | `jolly-text` |
| Object with numeric `from` and `to` | `jolly-range` |

`options` takes precedence over value type and numeric bounds. Its record keys
become option labels and its record values become bound values. Declaration
order is retained.

A numeric `step` without both bounds creates `jolly-number`. Unsupported
values, including `null` and `undefined`, cause `addBinding()` to throw a
`TypeError`.

## Write-back and change handlers

The builder listens to `jolly-input` and `jolly-change`. It assigns the event
value to `object[key]` before running registered handlers.

```ts
const settings = {
  opacity: 0.5
};

const binding = pane.addBinding(settings, "opacity", {
  min: 0,
  max: 1,
  step: 0.01
});

binding.on("change", ({ value, last }) => {
  preview.opacity = value;
  if (last) {
    saveSettings(settings);
  }
});
```

The callback receives:

```ts
interface BindingChangeEvent<TValue> {
  value: TValue;
  last: boolean;
}
```

`last` is `false` for `jolly-input` and `true` for `jolly-change`.
`on()` returns the same builder for chaining. Each call adds another handler.

## Builder surface

| Member | Behavior |
|---|---|
| `element` | The dispatched field element. |
| `hidden` | Reads or writes `element.hidden`. |
| `disabled` | Reads or writes the field's disabled state. |
| `refresh()` | Re-reads `object[key]` after an external assignment. |
| `dispose()` | Removes the field element. |

