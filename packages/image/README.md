<h1 align="center">
  image
</h1>

<p align="center">
  PNG codecs and browser raster decoding
</p>

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/image
# or
$ yarn add @jolly-pixel/image
```

## 👀 Usage example

```ts
import {
  decodePng,
  encodePng
} from "@jolly-pixel/image";

const { width, height, data } = await decodePng(bytes);
const png = await encodePng({
  width,
  height,
  data
});
```

## 📚 API

- [PNG](./docs/png.md)
- [Raster decoding](./docs/raster.md)

## License

MIT

[npm]: https://www.npmjs.com/
[yarn]: https://yarnpkg.com
