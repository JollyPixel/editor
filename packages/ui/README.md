<h1 align="center">
  ui
</h1>

<p align="center">
  Common and System's UI for JollyPixel's editors
</p>

## 📌 About

Browser-based Lit components for JollyPixel editor interfaces: controlled fields, actions, icons,
theming and collaboration-aware field state.

## 💡 Features

- **Form controls**: text, number, slider, range, checkbox, select, flags, color and button groups
- **Containers and chrome**: panes, folders, tabs, docks, floating panes, dialogs, toolbars and rails
- **Actions and layout**: buttons, separators and property rows
- **Controlled fields**: shared values, events, drafts, validation, mixed values and defaults
- **Collaboration state**: peer presence, field locking and peer colors
- **Theming**: light/dark themes, density presets and semantic custom-property tokens
- **Icons**: built-in glyphs and an open registry for custom icons

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/ui
# or
$ yarn add @jolly-pixel/ui
```

> [!IMPORTANT]
> `lit` is a peer dependency. Use one compatible copy in the application.

## 👀 Usage Example

Import the package to register its custom elements. Apply `themeStyles` to a shadow-root scope
host, then bind field values and change events:

```ts
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { themeStyles } from "@jolly-pixel/ui";

@customElement("settings-pane")
export class SettingsPane extends LitElement {
  static override styles = [themeStyles, css`:host { display: block; }`];

  #opacity = 1;

  override render() {
    return html`
      <jolly-text
        label="Name"
        .value=${"Player"}
      ></jolly-text>

      <jolly-number
        label="Opacity"
        .step=${0.01}
        .min=${0}
        .max=${1}
        .value=${this.#opacity}
        .default=${1}
        @jolly-change=${this.#setOpacity}
      ></jolly-number>

      <jolly-button variant="accent" @click=${this.#resetOpacity}>
        Reset opacity
      </jolly-button>
    `;
  }

  #setOpacity = (event: CustomEvent<{ value: number }>) => {
    this.#opacity = event.detail.value;
    this.requestUpdate();
  };

  #resetOpacity = () => {
    this.#opacity = 1;
    this.requestUpdate();
  };
}
```

`jolly-text`, `jolly-number` and `jolly-button` are components provided by this package. Fields are
controlled: they render the supplied `value` and emit changes, so the handler writes the new value
back into the component's state.

Set `density` on the scope host when needed:

```html
<settings-pane density="compact"></settings-pane>
```

## 📚 API

- [Fields](./docs/fields.md): shared properties, events, editing, states, `Mixed` and collaboration
- [Controls](./docs/controls.md): control-specific properties and behavior
- [Theming](./docs/theming.md): themes, density and custom-property tokens
- [Icons](./docs/icons.md): built-in icons and custom icon registration
- [Containers](./docs/containers.md): panes, folders, tabs, toolbars, rails and persistence
- [Placement](./docs/placement.md): docked and floating layout, resizing and movement
- [Dialogs](./docs/dialogs.md): declarative modal content and prompt/confirm helpers

The package currently ships twelve controls: `jolly-text`, `jolly-number`, `jolly-slider`, `jolly-range`,
`jolly-checkbox`, `jolly-select`, `jolly-flags`, `jolly-color`, `jolly-button-group`,
`jolly-button`, `jolly-separator` and `jolly-property-row`, plus the container elements and
`jolly-icon`.

## 🖼️ Examples Gallery

Every component has a gallery entry, which is also its only end to end fixture.

```bash
npm run dev
```

The gallery exercises the shared field states. Deep-link a control with or without the surrounding
shell:

```
/?example=controls/number
/?example=controls/number&chrome=off
```

## Contributors Guide

Read the [contributing guide][contributing] before making changes.

Run the package checks with:

```bash
npm run test
npm run test:e2e
npm run lint
```

Unit tests use `node:test`; end-to-end tests use Playwright against the gallery.

> [!IMPORTANT]
> Keep unit-test assertions in plain modules. Component decorators are not erasable syntax and
> cannot be imported directly by `node --test` with type stripping.

> [!CAUTION]
> Include tests for new features and bug fixes.

## License

MIT

This package embeds Roboto Mono (weight 400, latin subset), licensed under the
[Apache License 2.0][roboto-mono]. See [NOTICE](./NOTICE) for the full attribution. The face is
registered against the document on first import of `themeStyles`; call `ensureFontFace()` yourself
if you declare theme tokens by hand. Without it, `--jolly-font-family` falls back to the system
mono stack.

<!-- Reference-style links for DRYness -->

[npm]: https://docs.npmjs.com/getting-started/what-is-npm
[yarn]: https://yarnpkg.com
[contributing]: ../../CONTRIBUTING.md
[roboto-mono]: https://github.com/googlefonts/robotomono
