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
- [MergedSelectionOverlay](docs/MergedSelectionOverlay.md) - One shared outline overlay covering many targets in a single draw call, for bulk multi-select scenarios outside SelectionManager's own single-selection model.
- [SelectionManager](docs/SelectionManager.md) - Id-based selection/hover state, picking the right technique (outline overlay, group bounding box, or the coloredOutline technique) automatically.
- [SelectionOverlayRegistry](docs/SelectionOverlayRegistry.md) - Resolves a technique id + target to the overlay factory that builds it - the pluggable seam behind SelectionManager's `"outline"`/`"boundingBox"` (and any custom technique registered into it).
- [ColoredOutlinePass](docs/ColoredOutlinePass.md) - Scene-level postprocess outline rendering many simultaneously outlined objects (including individual InstancedMesh instances), each in its own arbitrary color and always fully visible regardless of occlusion, in a single shared pass. (TSL, `THREE.WebGPURenderer`).
- [PeerSelectionRegistry](docs/PeerSelectionRegistry.md) - Tracks which remote peers have which object selected, independent of the local user's own selection. Color assignment is pluggable via `PeerColorAllocator`.
- [PeerSelectionOverlays](docs/PeerSelectionOverlays.md) - Renders exactly one overlay per object a peer has selected, in the primary (oldest) selector's color.
- [PeerColoredOutlinePass](docs/PeerColoredOutlinePass.md) - Same role as PeerSelectionOverlays, driving a ColoredOutlinePass instead - scales to many peers/many simultaneous colors, works standalone with zero peers too.
- [PeerSelectionVisibility](docs/PeerSelectionVisibility.md) - Optional frustum + max-distance gating for peer indicators, accepted by PeerSelectionOverlays/PeerColoredOutlinePass; never affects the local user's own selection.
- [PeerSelectionChips](docs/PeerSelectionChips.md) - Small colored billboard chips above any object with more than one simultaneous peer selector, so every selector is visible in 3D, not just the primary one.

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
