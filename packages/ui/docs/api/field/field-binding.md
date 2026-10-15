# `FieldBinding`

`FieldBinding` wires one field in a Lit template to one value, without a
mirrored `@state` property. It is the template counterpart of the facade's
[`addBinding`](../facade/binding.md).

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

## Members

```ts
interface FieldBinding<TValue> {
  readonly value: TValue; // calls read(), not cached
  input: (event: Event) => void; // jolly-input, last false
  commit: (event: Event) => void; // jolly-change, last true
}
```

- `input` and `commit` are bound, so a template passes them directly.
- Both ignore an event whose detail has no `value`, such as
  `jolly-heading-change`.

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

- The binding stores nothing. Each render calls `read()`. A handler calls
  `write()`, then `host.requestUpdate()`.
- A source that clamps or rejects an edit needs no rollback: the next render
  shows what it holds.
- `read()` runs during render, so the source must exist by then.

```ts
#count = new FieldBinding<number>(this, {
  read: () => this.store.count,
  write: (value) => {
    this.store.count = Math.max(0, value);
  }
});
```

Typing `-5` writes `0`, and the field renders `0`.

## Binding a vector

A math field compares its value component-wise, so `read()` must return a
fresh snapshot, not the bound object. `write` decides what the store
receives; nothing is copied onto the bound object.

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

## Continuous and committed edits

- Bind `commit` alone when only the committed edit matters, as for a checkbox
  or a select.
- Bind `input` too for a slider or a scrubbed number.
- `last` tells the two apart:

```ts
write: (value, last) => {
  preview.opacity = value;
  if (last) {
    saveSettings();
  }
}
```

## Compared with `addBinding`

- `FieldBinding` authors in a Lit template, with `read`/`write` accessors, and
  keeps no state. The template names the element and its attributes.
- `addBinding` builds imperatively from an object and a key, picks the element
  from the value, and owns it.
