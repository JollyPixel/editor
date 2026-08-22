# Icon API

The icon package has two public layers:

- [`jolly-icon`](./icon.md) renders a registered glyph as a custom element.
- [The icon registry](./registry.md) registers application glyphs and exposes
  them to Lit templates.

Both layers are available from `@jolly-pixel/ui/icon` and the root entry
point. Importing either entry point registers the package's built-in glyphs.

```ts
import {
  Icon,
  getIcon,
  hasIcon,
  registerIcon
} from "@jolly-pixel/ui/icon";
```

`BuiltinIconName`, `IconName`, and `IconGlyph` describe registered names
and accepted glyph values.

