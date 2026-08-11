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
  cell: { size: 1 },
  section: { size: 10 }
});
scene.add(grid); // self-updating: no manual .update() call needed
```

## 📚 API

### Components

- [Network components](docs/network/index.md): Optional integrations with `@jolly-pixel/network`.
- [AreaBox](docs/AreaBox.md): Translucent axis-aligned area, moved and resized on a grid by [AreaBoxControls](docs/AreaBoxControls.md).
- [Grid](docs/Grid.md): Ground-plane grid mesh. (TSL, `THREE.WebGPURenderer`).
- [PeerFrustum](docs/PeerFrustum.md): Renders connected peers as lightweight camera frustums.
- [SelectionOutline](docs/SelectionOutline.md) - Non-destructive outline overlay for a selected mesh.
- [SelectionBoundingBox](docs/SelectionBoundingBox.md) - Non-destructive bounding-box overlay for a selected group of meshes.
- [SelectionManager](docs/SelectionManager.md) - Id-based selection/hover state, picking the right overlay (mesh vs. group) automatically.

### Network

Optional, behind the `@jolly-pixel/three/network` entry point.

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
