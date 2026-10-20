# Getting started

Put one themed field in a Lit element and keep its value in the element's
state.

## 1. Register the elements

```ts
import "@jolly-pixel/ui";
```

- The root entry point registers every `jolly-*` element. Import it once, from
  the application entry.
- `lit` is a peer dependency. The application and the package must share one
  copy.

## 2. Add a theme scope

```html
<body>
  <jolly-scope>
    <brush-panel></brush-panel>
  </jolly-scope>
</body>
```

Elements take their colours, spacing and font from tokens that `jolly-scope`
declares. Content outside a scope renders without them.
[Theming and density](./theming-and-density.md) covers the scope options.

## 3. Render a field and write its value back

```ts
import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { JollyChangeDetail } from "@jolly-pixel/ui";

@customElement("brush-panel")
export class BrushPanel extends LitElement {
  @state()
  declare size: number;

  constructor() {
    super();
    this.size = 4;
  }

  override render() {
    return html`
      <jolly-number
        label="Size"
        min="1"
        max="64"
        .value=${this.size}
        @jolly-change=${this.#onSize}
      ></jolly-number>
    `;
  }

  #onSize = (event: CustomEvent<JollyChangeDetail<number>>) => {
    this.size = event.detail.value;
  };
}
```

- `value` is a property, with no attribute: bind it with `.value`.
- The field shows `value` and reports edits. It never keeps an edit itself: if
  the handler does not write the value back, the next render shows the old
  value again.
- `jolly-change` is a committed edit, such as Enter, blur or a released
  slider. `jolly-input` reports the edit in progress: each step of a drag, or
  each keystroke in a `jolly-text`.
- Both events bubble and cross shadow roots, so one listener on a container
  hears every field below it.
- While a text-based field is focused, its draft wins over a new `value`, so
  an edit from elsewhere cannot rewrite text under the caret. Escape discards
  the draft.

## Next steps

- [Building an inspector](./building-an-inspector.md): many fields over one
  model, without a `@state` per field.
- [Preview and commit](./preview-and-commit.md): what to do on each of the two
  events.
- [Debug panels](./debug-panels.md): bind a plain object from JavaScript, with
  no template.
