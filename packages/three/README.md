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

- [AreaBox](docs/AreaBox.md): Translucent axis-aligned area, moved and resized on a grid by [BoxControls](docs/BoxControls.md).
- [Grid](docs/Grid.md): Ground-plane grid mesh. (TSL, `THREE.WebGPURenderer`).
- [MarqueeBox](docs/MarqueeBox.md): Empty axis-aligned box with animated two-color dashed edges, for 3D selections, moved and resized by [BoxControls](docs/BoxControls.md). (TSL, `THREE.WebGPURenderer`).
- [MeshHighlight](docs/mesh-highlight/index.md): Draws local and peer selection, with outline and postprocess rendering techniques.
- [TransformControls](docs/TransformControls.md): Customizable translate, rotate and scale gizmo for one `THREE.Object3D`, with a configurable orientation and pivot.

### Utilities

- `createCanvas2D(width, height)`: Returns a sized `{ canvas, context }` pair for canvas-backed textures, and throws when no 2D context is available.
- `projectToClient(camera, canvas, point)`: Projects a world point to client coordinates over `canvas.getBoundingClientRect()`, y pointing down, for placing HTML over a 3D view or aiming pointer events. Refreshes the camera's world matrices first, so a camera moved since the last render projects from its new pose. Returns `null` when the point is outside the camera's near and far range, including behind it.

### Network

Optional integrations are exported from `@jolly-pixel/three/network`.

- [Network guide](docs/network/index.md): Peer cameras, selection, and hover presence with `@jolly-pixel/network`.

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
