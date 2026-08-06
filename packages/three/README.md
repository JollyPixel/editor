<h1 align="center">
  three
</h1>

<p align="center">
  Common Three.js utilities and components for JollyPixel's workspaces and editors
</p>

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/three
# or
$ yarn add @jolly-pixel/three
```

## 👀 Usage example

```ts
import { Grid } from "@jolly-pixel/three";

const grid = new Grid({
  cellSize: 1,
  sectionSize: 10
});
scene.add(grid); // self-updating: no manual .update() call needed
```

## 📚 API

- [Grid](docs/Grid.md) - Ground-plane grid mesh. (TSL, `THREE.WebGPURenderer`).

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
