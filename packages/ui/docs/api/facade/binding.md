# Binding facade

`addBinding(object, key, options?)` creates a field for `object[key]` and
returns its builder.

```ts
pane.addBinding(settings, "opacity", { min: 0, max: 1, step: 0.01 })
  .on("change", ({ value, last }) => {
    preview.opacity = value;
    if (last) {
      saveSettings(settings);
    }
  });
```

## Options

```ts
interface BindingOptions<TValue> extends FieldLayoutOptions {
  label?: string; // default: the property key
  align?: "start" | "end"; // default "end" for a checkbox, else "start"
  path?: string; // lock path, see Presence below
  min?: number;
  max?: number;
  step?: number;
  options?: Record<string, TValue>; // label -> value, in declaration order
  view?: DispatchView;
  alpha?: boolean;
  axisLabels?: Record<string, string>;
  axes?: "xy" | "xz" | "yz";
  axisStyle?: AxisStyle;
  layout?: "segmented" | "grid";
  columns?: number;
  count?: number;
  mode?: "mask" | "index";
  start?: number;
  names?: Record<number, string>;
}

type DispatchView =
  | "buttons"
  | "flags"
  | "layers"
  | "point2d"
  | "quaternion"
  | "spin"
  | "toggle";
```

- `labelPosition` and `stackBelow` default to the pane's
  [field layout](./pane.md#field-layout).
- `path` is forwarded to the field's `path`. A
  [`PresenceSource`](../peer/presence-source.md) on the pane matches peer
  locks against it. Leave it unset for a field no peer can hold.

## Control selection

The first matching rule picks the element:

1. `options` with `view: "buttons"`: `jolly-button-group`.
2. `options` with `view: "flags"` on a number: `jolly-flags`.
3. `options`: `jolly-select`.
4. Boolean with `view: "toggle"`: `jolly-toggle`.
5. Boolean: `jolly-checkbox`.
6. Number with `view: "layers"`: `jolly-layer-grid`.
7. Number with `min`, `max` and `view: "spin"`: `jolly-spin-slider`.
8. Number with `min` and `max`: `jolly-slider`.
9. Other number: `jolly-number`.
10. Six- or eight-digit hex string: `jolly-color`.
11. Other string: `jolly-text`.
12. Object with numeric `from` and `to`: `jolly-range`.
13. Object with `x`, `y`, `z` and `w`: `jolly-vector4`, or `jolly-quaternion`
    with `view: "quaternion"`.
14. Object with `x`, `y` and `z`: `jolly-vector3`.
15. Object with `x` and `y`: `jolly-vector2`, or `jolly-point2d` with
    `view: "point2d"`.
16. Object with `x` and `z`, or `y` and `z`: `jolly-vector2` on that plane.

- A `view` the value does not match is ignored. `view: "flags"` on a value
  that is not a number falls back to `jolly-select`, and drops option values
  that are not numbers.
- `null`, `undefined` and other values throw a `TypeError`.
- `jolly-transform` is not dispatched. Compose it from three bindings, or use
  the element.

```ts
folder.addBinding(settings, "mode", {
  view: "buttons",
  options: { Pos: "translate", Angle: "rotate", Scale: "scale" }
});

folder.addBinding(layer, "mask", {
  view: "flags",
  options: { Default: 1, Player: 2, Terrain: 4 }
});

folder.addBinding(camera, "cullMask", { view: "layers", count: 20 });
```

## Per-element options

- `min`, `max`, `step`: numbers, ranges, vectors and `jolly-point2d`, shared by
  every axis.
- `step` on `jolly-quaternion`: degrees per scrub step or arrow key.
- `alpha`: `jolly-color` writes `#rrggbbaa`. On by default for an
  eight-digit value.
- `axisLabels`: per-axis accessible names, such as `{ x: "pitch" }`.
- `axisStyle`: `"corner"`, `"chip"` or `"letter"`, see
  [axis markers](../math/README.md#axis-markers).
- `axes`: the plane of `jolly-vector2`. Defaults to the pair the value
  carries, so `{ x, z }` edits and writes back `x` and `z`.
- `layout`, `columns`: `jolly-button-group` layout. Zero `columns` sizes the
  grid itself.
- `columns` on `jolly-layer-grid`: cells per row of one block. Zero or less
  keeps the default `5`.
- `count`, `mode`, `start`, `names`: forwarded to
  [`jolly-layer-grid`](../controls/layer-grid.md#properties).

## Write-back

- The builder listens to `jolly-input` and `jolly-change`, assigns the value
  to `object[key]`, then runs the handlers.
- A math value is copied axis by axis onto the object already at
  `object[key]`, so a `THREE.Vector3` keeps its identity. Axes the object does
  not carry are skipped.

```ts
pane
  .addBinding(area, "position", { step: 1, label: "Min corner" })
  .on("change", ({ value }) => {
    // Still the same THREE.Vector3.
    mesh.position.copy(value);
  });
```

## Builder

```ts
interface FacadeBinding<TObject, TKey> extends FacadeItem {
  on(name: "change", handler: BindingChangeHandler<TObject[TKey]>): this;
  refresh(): void; // re-reads object[key]
}

interface BindingChangeEvent<TValue> {
  value: TValue;
  last: boolean; // false for jolly-input, true for jolly-change
}
```

- Each `on()` call adds a handler.
- Use `last` to save or record history once per committed edit.
