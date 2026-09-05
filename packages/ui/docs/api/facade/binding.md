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
  view?: "point2d" | "quaternion";
  alpha?: boolean;
  axisLabels?: Record<string, string>;
  axes?: "xy" | "xz" | "yz";
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
| Object with numeric `x` and `y` | `jolly-vector2` |
| Object also carrying `z` | `jolly-vector3` |
| Object also carrying `w` | `jolly-vector4` |
| Object with two of `x`, `y` and `z` | `jolly-vector2` on that plane |

`options` takes precedence over value type and numeric bounds. Its record keys
become option labels and its record values become bound values. Declaration
order is retained.

Vector shapes are tested widest first, so `{ x, y, z }` is a three-axis value
rather than the two-axis one it also satisfies. `view` picks an alternate
control for a shape that already dispatches: `"point2d"` turns a two-axis value
into a drag pad, `"quaternion"` reads a four-axis value as a rotation and edits
it in degrees. A `view` the value does not match is ignored.

A two-axis value is bound on the plane it carries, so `{ x, z }` gets a field
labelled X and Z writing back those same keys. `axes` overrides that plane.

A numeric `step` without both bounds creates `jolly-number`. Unsupported
values, including `null` and `undefined`, cause `addBinding()` to throw a
`TypeError`.

`jolly-transform` is not dispatched. It is not a `JollyField`, so it carries
no `label`, `disabled`, `align` or `path`, and its three sub-fields lock
independently. Compose one from three bindings instead, or use the element
directly.

## Per-element options

| Option | Applies to | Behavior |
|---|---|---|
| `min`, `max`, `step` | numbers, ranges, vectors, `jolly-point2d` | Bounds and increment, shared by every axis of a vector. |
| `step` | `jolly-quaternion` | Degrees per scrub step or arrow key press. |
| `alpha` | `jolly-color` | Adds an alpha channel and switches output to `#rrggbbaa`. Defaults to on when the bound value is already eight digits. |
| `axisLabels` | vectors, `jolly-quaternion` | Per-axis accessible names, e.g. `{ x: "pitch" }`. |
| `axes` | `jolly-vector2` | Which plane the field edits. Defaults to the pair the bound value carries. |

## Write-back and change handlers

The builder listens to `jolly-input` and `jolly-change`. It assigns the event
value to `object[key]` before running registered handlers.

A math value is the exception. Its axes are copied onto the object already at
`object[key]`, which keeps that object's identity and its methods, so a
`THREE.Vector3` survives an edit intact. Axes the bound object does not carry
are left out. `refresh()` assigns the field a fresh record rather than the
bound object, because a field compares its value component-wise and would
otherwise see no change at all.

```ts
const area = {
  position: new THREE.Vector3(0, 0, 0)
};

pane
  .addBinding(area, "position", { step: 1, label: "Min corner" })
  .on("change", ({ value }) => {
    // Still the same THREE.Vector3, now carrying the edited axes.
    mesh.position.copy(value);
  });
```

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

