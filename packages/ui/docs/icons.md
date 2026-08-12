# Icons

`jolly-icon` renders registered SVG glyphs. Icons use `currentColor` and default to 16px; set
`--jolly-icon-size` to change their size.

```html
<jolly-icon name="search"></jolly-icon>
<jolly-icon name="close" label="Close panel"></jolly-icon>
```

Icons are decorative unless `label` is set. Provide one when the icon is the only accessible name
for its control.

## Built-in names

`chevron`, `close`, `revert`, `drag`, `lock`, `eye`, `search`, `check`, `info`, and
`warning`.

`jolly-button` and `JollyOption` accept icon names directly:

```ts
field.options = [{ value: "move", label: "Move", icon: "drag" }];
```

## Registering icons

```ts
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("cube", "<path d=\"m12 3 7 4v8l-7 4-7-4V7l7-4Z\" />");
```

`IconName` autocompletes built-ins while allowing custom strings. Registering an existing name
replaces it; unknown names render nothing and warn once. You can register a Lit
`SVGTemplateResult` for dynamic glyphs. String glyphs are SVG markup, so register only trusted
content.

Register glyph contents only. `jolly-icon` supplies the SVG wrapper, viewBox, and ARIA. Use a
24px viewBox with `fill="none"` and `stroke="currentColor"` for custom stroked icons.
