# `FieldBinding`

`FieldBinding` is the template-side counterpart of the facade's
[`addBinding`](../facade/binding.md). It wires one field element to one value
without a mirrored `@state` property.

```ts
import { FieldBinding } from "@jolly-pixel/ui";

new FieldBinding<TValue>(
  host: ReactiveControllerHost,
  source: FieldSource<TValue>
)

interface FieldSource<TValue> {
  read(): TValue;
  write(value: TValue, last: boolean): void;
}
```

| Member | Behavior |
|---|---|
| `value` | Calls `read()`. Not cached. |
| `input` | Handler for `jolly-input`. Writes with `last` as `false`. |
| `commit` | Handler for `jolly-change`. Writes with `last` as `true`. |

`input` and `commit` are bound, so a template passes them directly. Both
ignore an event whose detail carries no `value`, so binding one to an event
with a different detail shape, such as `jolly-heading-change`, writes nothing
rather than writing `undefined`.

```ts
@customElement("lighting-panel")
export class LightingPanel extends LitElement {
  @property({ attribute: false })
  declare scene: Scene;

  #flat = new FieldBinding<boolean>(this, {
    read: () => this.scene.lighting.mode === "flat",
    write: (value) => {
      this.scene.lighting.mode = value ? "flat" : "lit";
    }
  });

  #radius = new FieldBinding<number>(this, {
    read: () => this.scene.skyRadius,
    write: (value) => {
      this.scene.skyRadius = value;
    }
  });

  override render() {
    return html`
      <jolly-checkbox
        label="Flat lighting"
        .value=${this.#flat.value}
        @jolly-change=${this.#flat.commit}
      ></jolly-checkbox>

      <jolly-slider
        label="Sky radius"
        min="0"
        max="32"
        .value=${this.#radius.value}
        @jolly-input=${this.#radius.input}
        @jolly-change=${this.#radius.commit}
      ></jolly-slider>
    `;
  }
}
```

## Reading through

The binding stores nothing. Every render calls `read()`, and a handler calls
`write()` then `host.requestUpdate()`, so the following render shows what the
source actually holds. A source that clamps or rejects an edit needs no
rollback:

```ts
#count = new FieldBinding<number>(this, {
  read: () => this.store.count,
  write: (value) => {
    this.store.count = Math.max(0, value);
  }
});
```

Typing `-5` writes `0` and the field renders `0`. This is the element contract
from [Controlled elements](../../adr/0002-controlled-elements.md), which a
mirrored `@state` copy would break.

`read()` runs during render, so the source must be reachable by then. A panel
whose store arrives as a property should not render until it has one.

## Binding a vector

A math field compares its value component-wise, so the same object compares
equal to itself and the field never repaints. `read()` must therefore return a
fresh snapshot rather than the bound object:

```ts
#position = new FieldBinding<Vec3Like>(this, {
  read: () => {
    const { x, y, z } = this.layer.position;

    return { x, y, z };
  },
  write: (value) => {
    this.world.setLayerPosition(this.layerName, {
      x: Math.round(value.x),
      y: Math.round(value.y),
      z: Math.round(value.z)
    });
  }
});
```

This is the same rule `Binding.refresh()` follows in the facade, for the same
reason: see
[ADR-0027](../../adr/0027-facade-math-writes-are-component-wise.md) and
[ADR-0021](../../adr/0021-structural-math-types.md). Unlike the facade,
`FieldBinding` does not copy the committed axes onto the bound object; `write`
decides what the store receives.

## Continuous and committed edits

Bind `commit` alone when only a committed edit matters, which is the common
case for a checkbox or a select. Bind `input` as well for a slider or a
scrubbed number, so dragging updates the application live. `write()` receives
`last` to tell the two apart, matching the facade's `BindingChangeEvent`:

```ts
write: (value, last) => {
  preview.opacity = value;
  if (last) {
    saveSettings();
  }
}
```

## Choosing between the two bindings

| | `FieldBinding` | `addBinding` |
|---|---|---|
| Authoring | Lit template | Imperative builder |
| Element | Written by the template | Dispatched from the value |
| Value access | `read`/`write` accessors | An object and a property key |
| State | None | The builder owns the element |

`FieldBinding` does not dispatch a control: the template already names one, so
`min`, `max`, `options` and the rest are attributes on that element. See
[Binding facade](../facade/binding.md) for the dispatch table, and
[ADR-0040](../../adr/0040-declarative-bindings-read-through.md) for why this
one keeps no mirror.
