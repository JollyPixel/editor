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
- [SelectionManager](docs/SelectionManager.md) - Id-based selection/hover state, picking the right technique (outline overlay, group bounding box, or the highlight technique) automatically.
- [SelectionOverlayRegistry](docs/SelectionOverlayRegistry.md) - Resolves a technique id + target to the overlay factory that builds it - the pluggable seam behind SelectionManager's `"outline"`/`"boundingBox"` (and any custom technique registered into it).
- [HighlightPass](docs/HighlightPass.md) - Scene-level postprocess outline rendering many simultaneously outlined objects (including individual InstancedMesh instances), each in its own arbitrary color and always fully visible regardless of occlusion, in a single shared pass (blurred edge map). (TSL, `THREE.WebGPURenderer`).
- [HighlightPassJfa](docs/HighlightPassJfa.md) - Same `HighlightEntry`/`setEntries` shape as HighlightPass, but a Jump Flood Algorithm distance field instead of a blurred edge map - a uniform, resolution-independent ring. (TSL, `THREE.WebGPURenderer`).
- [PeerSelectionRegistry](docs/PeerSelectionRegistry.md) - Tracks which remote peers have which object selected, independent of the local user's own selection. Color assignment is pluggable via `PeerColorAllocator`.
- [PeerSelectionOverlays](docs/PeerSelectionOverlays.md) - Renders exactly one overlay per object a peer has selected, in the primary (oldest) selector's color.
- [PeerHighlightPass](docs/PeerHighlightPass.md) - Same role as PeerSelectionOverlays, driving a HighlightPass or HighlightPassJfa instead - scales to many peers/many simultaneous colors, works standalone with zero peers too.
- [PeerSelectionVisibility](docs/PeerSelectionVisibility.md) - Optional frustum + max-distance gating for peer indicators, accepted by PeerSelectionOverlays/PeerHighlightPass/PeerHoverOverlays; never affects the local user's own selection/hover.
- [PeerSelectionChips](docs/PeerSelectionChips.md) - Small colored billboard chips above any object with more than one simultaneous peer selector, so every selector is visible in 3D, not just the primary one.
- [PeerHoverRegistry](docs/PeerHoverRegistry.md) - Tracks which remote peers currently hover which object, independent of the local user's own hover - the hover counterpart to PeerSelectionRegistry.
- [PeerHoverOverlays](docs/PeerHoverOverlays.md) - Renders exactly one dashed, faded overlay per object a peer is hovering, for the `"outline"` technique - suppressed by any selector (local or peer) on the object, and by the local user's own hover.

### Network

Optional, behind the `@jolly-pixel/three/network` entry point.

- [PeerFrustumSync](docs/network/PeerFrustumSync.md) - Publishes an `Object3D` pose and renders remote peers as `PeerFrustum`s.
- [PeerSelectionSync](docs/network/PeerSelectionSync.md) - Publishes the local `SelectionManager`'s selected id and applies remote peers' selections into a `PeerSelectionRegistry`.
- [PeerHoverSync](docs/network/PeerHoverSync.md) - Publishes the local `SelectionManager`'s hovered id and applies remote peers' hovers into a `PeerHoverRegistry`, throttled with a trailing flush.

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
