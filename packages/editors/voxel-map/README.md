<h1 align="center">
  Voxel-Map Editor
</h1>

<p align="center">
  Collaborative voxel-map editing for JollyPixel
</p>

## 📌 About

Private editor workspace built on [`@jolly-pixel/voxel.renderer`][voxel-renderer] and booted through [`@jolly-pixel/editor.host`][editor-host].

## 🚀 Running the editor

```bash
$ pnpm install
$ pnpm --filter @jolly-pixel/editor.voxel-map dev
```

| Query parameter | Effect |
|---|---|
| `?target=<assetId>` | Open another map |
| `?max-fps=<n>` | Cap the frame rate |
| `?offline` | Run the asset back-end in the page (IndexedDB) |

The dev server seeds its workspace under `assets/`; delete that directory to seed it again.

Auto orientation makes stairs rise away from the camera. Outer stair corners
and peaks receive a half turn to account for their default shape geometry;
slab notches receive the same turn to align with their stair complement.
Explicit rotations keep the renderer's original shape orientation.

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/editor.voxel-map test
$ pnpm --filter @jolly-pixel/editor.voxel-map typecheck
$ pnpm --filter @jolly-pixel/editor.voxel-map lint
$ pnpm exec playwright install chromium
$ pnpm --filter @jolly-pixel/editor.voxel-map test:e2e
```

Add any new `@jolly-pixel/*` entry point imported by `src/` to `kWorkspaceBrowserEntries` in `vite.config.ts` (see the [e2e README][e2e]).

## Contributors Guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

## License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../../CONTRIBUTING.md
[voxel-renderer]: ../../voxel-renderer/README.md
[editor-host]: ../host/README.md
[e2e]: ../../e2e/README.md#-starting-a-new-suite
