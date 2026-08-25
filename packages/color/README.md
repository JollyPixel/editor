<h1 align="center">
  color
</h1>

<p align="center">
  The color utilities for JollyPixel's editors
</p>

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/color
# or
$ yarn add @jolly-pixel/color
```

## 👀 Usage example

```ts
import { formatHex, parseColor } from "@jolly-pixel/color";

const color = parseColor("hsl(210 40% 17%)");
// { r: 0.102, g: 0.17, b: 0.238, a: 1 }

formatHex(color);  // "#1a2b3d"
```

`parseColor` returns `null` for invalid or incomplete input. Use `assertColor`
when an invalid value is a programming error:

```ts
import { assertColor } from "@jolly-pixel/color";

assertColor("rgb(255 102 0 / 50%)");  // { r: 1, g: 0.4, b: 0, a: 0.5 }
assertColor("not-a-color");           // throws ColorParseError
```

`RGBA` uses channels from 0 to 1. Convert to the byte-based `RGBA8` type for
`ImageData` or network payloads:

```ts
import { toRGBA8 } from "@jolly-pixel/color";

toRGBA8({ r: 1, g: 0.4, b: 0, a: 1 });  // { r: 255, g: 102, b: 0, a: 255 }
```

Use `colorFromKey` with a stable string key. Use `goldenAngleColor` with a
numeric index:

```ts
import { colorFromKey, goldenAngleColor } from "@jolly-pixel/color";

colorFromKey(peer.username);  // stable per key, from a curated palette
goldenAngleColor(index);      // unbounded, hues a golden angle apart
```

## 📚 API

- [Parsing](./docs/parse.md)
- [Formatting](./docs/format.md)
- [Types and conversion](./docs/convert.md)
- [Contrast](./docs/contrast.md)
- [Palettes](./docs/palette.md)

## 🧪 Benchmarks

The suite measures parsing per notation and hex formatting.

```bash
npm run bench -w @jolly-pixel/color
```

## ✨ Contributors guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Once you have finished your development, check that the tests (and linter) are still good by running the following script:

```bash
$ npm run test
$ npm run lint
```

> [!CAUTION]
> In case you introduce a new feature or fix a bug, make sure to include tests for it as well.

## 📃 License

MIT

<!-- Reference-style links for DRYness -->

[npm]: https://docs.npmjs.com/getting-started/what-is-npm
[yarn]: https://yarnpkg.com
[contributing]: ../../CONTRIBUTING.md
