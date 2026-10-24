# Building an inspector

Edit the properties of the selected object from a Lit element, with one
`FieldBinding` per field and no mirrored `@state`.

## 1. Bind a field to the model

```ts
import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { FieldBinding } from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/slider";

@customElement("light-inspector")
export class LightInspector extends LitElement {
  @property({ attribute: false })
  declare light: Light | null;

  #intensity = new FieldBinding<number>(this, {
    read: () => this.light?.intensity ?? 0,
    write: (value) => {
      this.light?.setIntensity(value);
    }
  });

  constructor() {
    super();
    this.light = null;
  }

  override render() {
    if (this.light === null) {
      return nothing;
    }

    return html`
      <jolly-slider
        label="Intensity"
        min="0"
        max="10"
        step="0.1"
        .value=${this.#intensity.value}
        @jolly-input=${this.#intensity.input}
        @jolly-change=${this.#intensity.commit}
      ></jolly-slider>
    `;
  }
}
```

- `read()` runs on every render, so the field shows what the model holds. A
  model that clamps or refuses a write needs no rollback.
- `write()` is followed by an update of the host.
- Bind `commit` alone for a checkbox or a select. Add `input` for a slider or
  a scrubbed number. [Preview and commit](./preview-and-commit.md) covers what
  `write()` should do with each.
- An edit made elsewhere, by undo or by a peer, shows only once the host
  renders again. [Keeping an element in sync](./syncing-with-a-model.md)
  subscribes the host to the model.

## 2. Write one source for many keys

A settings object with several keys needs the same source for each. Write a
factory once:

```ts
import { FieldBinding, type FieldSource } from "@jolly-pixel/ui";

#intensity = new FieldBinding(this, this.#source("intensity"));
#range = new FieldBinding(this, this.#source("range"));
#castShadow = new FieldBinding(this, this.#source("castShadow"));

#source<TKey extends keyof LightSettings>(
  key: TKey
): FieldSource<LightSettings[TKey]> {
  return {
    read: () => (this.light?.settings ?? Light.defaults)[key],
    write: (value) => {
      const patch: Partial<LightSettings> = {};
      patch[key] = value;
      this.light?.update(patch);
    }
  };
}
```

A source that adjusts values, such as one that rounds a position to the grid,
can be a class implementing `FieldSource<T>`, shared between panels.

## 3. Pick a control per value

- `string`: [`jolly-text`](../api/controls/text.md).
- Unbounded `number`: [`jolly-number`](../api/controls/number.md). Bounded:
  [`jolly-slider`](../api/controls/slider.md), or
  [`jolly-spin-slider`](../api/controls/spin-slider.md) in a narrow column.
- `{ from, to }` interval: [`jolly-range`](../api/controls/range.md).
- `boolean`: [`jolly-checkbox`](../api/controls/checkbox.md), or
  [`jolly-toggle`](../api/controls/toggle.md) with the label inside the box.
- One value out of a list: [`jolly-select`](../api/controls/select.md), or
  [`jolly-button-group`](../api/controls/button-group.md) to keep every option
  visible.
- Bitmask: [`jolly-flags`](../api/controls/flags.md) for a few named bits,
  [`jolly-layer-grid`](../api/controls/layer-grid.md) for up to 32 layers.
- Hex colour: [`jolly-color`](../api/controls/color.md).
- Vectors, rotations and transforms: the [axis fields](../api/math/axis-fields.md).

## 4. Bind a vector

```ts
#position = new FieldBinding<Vec3Like>(this, {
  read: () => {
    const { x, y, z } = this.light?.position ?? kOrigin;

    return { x, y, z };
  },
  write: (value) => {
    this.light?.moveTo(value);
  }
});
```

```ts
html`
  <jolly-vector3
    label="Position"
    .value=${this.#position.value}
    @jolly-input=${this.#position.input}
    @jolly-change=${this.#position.commit}
  ></jolly-vector3>
`;
```

- Return a copy from `read()`. The field compares the new value with the
  previous one axis by axis, and a vector mutated in place equals itself.
- `Vec3Like` is structural: a `THREE.Vector3` fits, and the package does not
  depend on Three.js.

## 5. Show a multi-selection

When the selected objects disagree, show `Mixed`:

```ts
import { FieldBinding, Mixed, type FieldValue } from "@jolly-pixel/ui";

#intensity = new FieldBinding<FieldValue<number>>(this, {
  read: () => shared(this.selection, (light) => light.intensity),
  write: (value) => {
    if (value === Mixed) {
      return;
    }
    for (const light of this.selection) {
      light.setIntensity(value);
    }
  }
});

function shared<T>(
  lights: readonly Light[],
  pick: (light: Light) => T
): FieldValue<T> {
  const [first, ...rest] = lights.map(pick);

  return rest.every((value) => value === first) ? first : Mixed;
}
```

- The field shows a placeholder until an edit commits a concrete value, which
  then goes to every selected object.
- Render nothing for an empty selection: `shared` expects at least one object.
- Each axis of a vector field can be `Mixed` on its own. An edit to one axis
  emits the whole vector with the other axes still `Mixed`, so write the
  concrete axes only:

```ts
write: (value: VectorValue<"x" | "y" | "z">) => {
  if (value === Mixed) {
    return;
  }
  for (const light of this.selection) {
    for (const axis of ["x", "y", "z"] as const) {
      if (value[axis] !== Mixed) {
        light.position[axis] = value[axis];
      }
    }
  }
}
```

## 6. Lay out the rows

```html
<jolly-folder label="Shadows" storage-key="light-inspector:shadows">
  <jolly-checkbox label="Cast"></jolly-checkbox>
  <jolly-separator label="Bias"></jolly-separator>
  <jolly-number label="Normal"></jolly-number>
</jolly-folder>
<jolly-property-row label="Preset">
  <jolly-button>Save</jolly-button>
</jolly-property-row>
```

```css
light-inspector {
  --jolly-label-width: 10ch;
}
```

- [`jolly-folder`](../api/containers/folder.md) folds a group. With
  `storage-key`, it keeps its open state across reloads.
- [`jolly-separator`](../api/controls/separator.md) captions a group that does
  not fold.
- [`jolly-property-row`](../api/controls/property-row.md) lines up custom
  content with the field labels.
- `--jolly-label-width` gives every row the same label column, so the values
  align.
- `.default=${Light.defaults.intensity}` shows a revert button while the value
  differs. Clicking it emits `jolly-change` with the default.
- `label-position="auto"` stacks the label above the value in a narrow pane.
- [`jolly-tabs`](../api/containers/tabs.md) splits a long inspector into
  tabbed regions.
