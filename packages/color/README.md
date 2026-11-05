<p align="center">
  <img src="./docs/banner.png" alt="JollyPixel">
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
import { Color } from "@jolly-pixel/color";

const color = Color.parse("hsl(210 40% 17%)");
// Color { r: 0.102, g: 0.17, b: 0.238, a: 1 }, or null when invalid

color?.hex();  // "#1a2b3d"
```

Use `Color.from` when an invalid value is a programming error:

```ts
Color.from("rgb(255 102 0 / 50%)").rgba();  // "rgba(255, 102, 0, 0.5)"
Color.from("not-a-color");                  // throws ColorParseError
```

A `Color` uses channels from 0 to 1. Convert to and from the byte-based
`RGBA8` type for `ImageData` or network payloads:

```ts
Color.from("#ff6600").toBytes();                    // { r: 255, g: 102, b: 0, a: 255 }
Color.fromBytes({ r: 255, g: 102, b: 0, a: 128 });  // Color { r: 1, g: 0.4, b: 0, a: 0.502 }
```

Convert through a `ColorSpace`. Passing the previous point keeps its hue on
grays:

```ts
import { ColorSpace } from "@jolly-pixel/color";

const point = ColorSpace.okhsv.fromRgb(color, previousPoint);
ColorSpace.okhsv.toRgb({ ...point, v: 0.5 });
```

Use a `ColorSequence` to color peers or objects by key or index:

```ts
import { ColorSequence } from "@jolly-pixel/color";

ColorSequence.default.pick(peer.username);  // stable per key
ColorSequence.goldenAngle().at(index);      // hues a golden angle apart
```

## 📚 API

- [Color](./docs/Color.md): parsing, writing, compositing and contrast
- [Types and conversion](./docs/convert.md)
- [Mixing and harmonies](./docs/mix.md)
- [Palettes](./docs/palette.md)

## 🧪 Benchmarks

One suite per module: parsing per notation (including rejected input), formatting, conversion, contrast and palettes.

```bash
pnpm --filter @jolly-pixel/color bench
```

## ✨ Contributors guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Once you have finished your development, check that the tests (and linter) are still good by running the following script:

```bash
$ pnpm run test
$ pnpm run lint
```

> [!CAUTION]
> In case you introduce a new feature or fix a bug, make sure to include tests for it as well.

## 📃 License

MIT

<!-- Reference-style links for DRYness -->

[npm]: https://docs.npmjs.com/getting-started/what-is-npm
[yarn]: https://yarnpkg.com
[contributing]: ../../CONTRIBUTING.md
