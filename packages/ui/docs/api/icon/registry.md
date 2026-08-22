# Icon registry

The icon registry stores glyphs by string name. It is available from both
`@jolly-pixel/ui/icon` and the root entry point.

```ts
import {
  getIcon,
  hasIcon,
  registerIcon
} from "@jolly-pixel/ui/icon";
```

The package registers these names on a shared 24 by 24 SVG grid:

`chevron`, `close`, `revert`, `drag`, `lock`, `eye`, `search`,
`check`, `info`, and `warning`.

## Register a Lit SVG glyph

```ts
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui/icon";

registerIcon("cube", svg`
  <path
    d="m12 3 7 4v8l-7 4-7-4V7l7-4Z"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
  />
`);
```

```ts
registerIcon(name: string, glyph: IconGlyph): void
```

`IconGlyph` accepts a Lit `SVGTemplateResult` or a markup string.
Registering an existing name replaces its glyph. Register custom icons before
rendering them; registry changes do not request updates from existing
`jolly-icon` elements.

Glyphs should use the 24 by 24 view box expected by `jolly-icon`.
`currentColor` makes strokes and fills follow the surrounding text color.

## Register a markup string

```ts
registerIcon(
  "cube",
  '<path d="m12 3 7 4v8l-7 4-7-4V7l7-4Z" />'
);
```

String glyphs are passed to Lit's `unsafeSVG` directive. Use this form only
for trusted markup shipped with the application. The registry does not
sanitize the string.

## Read the registry

```ts
getIcon(name: IconName): SVGTemplateResult | null
hasIcon(name: IconName): boolean
```

`getIcon()` returns the stored Lit SVG template or `null` for an unknown
name. `hasIcon()` tests the same map without retrieving the template.

Use `getIcon()` when an application owns the surrounding SVG:

```ts
import {
  svg,
  type SVGTemplateResult
} from "lit";
import { getIcon } from "@jolly-pixel/ui/icon";

type EditorIconName = "move" | "paint";

function renderEditorIcon(
  name: EditorIconName
): SVGTemplateResult {
  return svg`
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      ${getIcon(name)}
    </svg>
  `;
}
```

For standard DOM use, let [`jolly-icon`](./icon.md) create the SVG and provide
its accessible label.

## Types

`BuiltinIconName` is the union of the ten package names. `IconName` preserves
completion for those names while accepting application-defined strings.
`IconGlyph` is `string | SVGTemplateResult`.

