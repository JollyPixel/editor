# Icons

`jolly-icon` renders registered SVG glyphs. Icons use `currentColor` and default to 16px; set
`--jolly-icon-size` to change the size.

```html
<jolly-icon name="search"></jolly-icon>
<jolly-icon name="close" label="Close panel"></jolly-icon>
```

Icons are decorative unless `label` is provided. Use a label when the icon is the only accessible
name for its control.

## Built-in names

`chevron`, `close`, `revert`, `drag`, `lock`, `eye`, `search`, `check`, `info`, `warning`.

`jolly-button` and `JollyOption` accept icon names directly:

```ts
field.options = [
  { value: "move", label: "Move", icon: "drag" }
];
```

## Registering icons

```ts
import { registerIcon } from "@jolly-pixel/ui";
import { svg } from "lit";

registerIcon("cube", svg`<path d="m12 3 7 4v8l-7 4-7-4V7l7-4Z" />`);
```

`IconName` provides autocomplete for built-ins while allowing custom strings. Registering an
existing name replaces it. Unknown names render nothing and warn once.

Register only the glyph contents; `jolly-icon` supplies the SVG wrapper, viewBox and ARIA.
Author custom glyphs for a 24px viewBox with `fill="none"` and `stroke="currentColor"`.
