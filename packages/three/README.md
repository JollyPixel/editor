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

- [Grid](docs/Grid.md) - Ground-plane grid mesh. (TSL, `THREE.WebGPURenderer`).
- [PeerFrustum](docs/PeerFrustum.md) - Renders connected peers as lightweight camera frustums.
- [SelectionOutline](docs/SelectionOutline.md) - Non-destructive outline overlay for a selected mesh.
- [SelectionOutline](docs/SelectionOutline.md) - Non-destructive edge outline overlay for a selected mesh.
- [SelectionHighlight](docs/SelectionHighlight.md) - Non-destructive inverted-hull rim overlay for a selected mesh, reads cleanly on smooth/high-poly geometry where SelectionOutline doesn't. (TSL, `THREE.WebGPURenderer`).
- [SelectionBoundingBox](docs/SelectionBoundingBox.md) - Non-destructive bounding-box overlay for a selected group of meshes.
- [MergedSelectionOverlay](docs/MergedSelectionOverlay.md) - One shared outline/highlight overlay covering many targets in a single draw call, for bulk multi-select scenarios outside SelectionManager's own single-selection model.
- [SelectionManager](docs/SelectionManager.md) - Id-based selection/hover state, picking the right technique (outline/highlight overlay, group bounding box, or ToonOutlinePass) automatically.
- [ToonOutlinePass](docs/ToonOutlinePass.md) - Scene-level postprocess selection outline, wireable into SelectionManager as the `"toonOutline"` style. Outlines individual instances of a `THREE.InstancedMesh` too. (TSL, `THREE.WebGPURenderer`).
- [InstancedOutlineNode](docs/InstancedOutlineNode.md) - The TSL node backing ToonOutlinePass - a maintained fork of three's own OutlineNode, extended with per-instance selection support. (TSL, `THREE.WebGPURenderer`).
- [ColoredOutlinePass](docs/ColoredOutlinePass.md) - Scene-level postprocess outline rendering many simultaneously outlined objects (including individual InstancedMesh instances), each in its own arbitrary color, in a single shared pass. (TSL, `THREE.WebGPURenderer`).
- [ColorPalette](docs/ColorPalette.md) - Round-robin or deterministic-per-key color assignment, used to give remote peers stable colors.
- [PeerSelectionRegistry](docs/PeerSelectionRegistry.md) - Tracks which remote peers have which object selected, independent of the local user's own selection.
- [PeerSelectionOverlays](docs/PeerSelectionOverlays.md) - Renders exactly one overlay per object a peer has selected, in the primary (oldest) selector's color.
- [PeerColoredOutline](docs/PeerColoredOutline.md) - Same role as PeerSelectionOverlays, driving a ColoredOutlinePass instead - scales to many peers/many simultaneous colors.

## ✨ Contributors guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Once you have finished your development, check that the tests (and linter) are still good by running the following script:

```bash
$ npm run test
$ npm run lint # run at the root of .git repository
```

> [!CAUTION]
> In case you introduce a new feature or fix a bug, make sure to include tests for it as well.

## 📃 License

MIT

<!-- Reference-style links for DRYness -->

[npm]: https://docs.npmjs.com/getting-started/what-is-npm
[yarn]: https://yarnpkg.com
[contributing]: ../../CONTRIBUTING.md
