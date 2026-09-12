<h1 align="center">
  Voxel-Map Editor
</h1>

<p align="center">
  Collaborative voxel-map editing for JollyPixel
</p>

## 📌 About

This private workspace combines [`@jolly-pixel/voxel.renderer`][voxel-renderer] with the JollyPixel runtime and Lit UI. It edits voxel and object layers, block definitions, tileset textures, and map JSON.

## 🚀 Running the editor

Install dependencies from the monorepo root, then start the Vite server:

```bash
$ npm install
$ npm run dev -w @jolly-pixel/editor.voxel-map
```

The default URL connects to the asset catalog and collaborative sync server configured by Vite. On a first run the server seeds two documents: `maps/overworld.voxelmap.json`, holding a `Ground` layer and the `default` tileset, and `textures/block.pixelart`, holding the pixels of `public/textures/tileset.png`. Both live under `assets/`; delete that directory to seed it again.

Add `?offline` to skip network setup entirely. Nothing is persisted in that mode — the editor is scratch space until the page reloads.

## 🧪 Tests and checks

```bash
$ npm run test -w @jolly-pixel/editor.voxel-map
$ npm run typecheck -w @jolly-pixel/editor.voxel-map
$ npm run lint -w @jolly-pixel/editor.voxel-map
$ npm run build -w @jolly-pixel/editor.voxel-map
```

`test-only` runs the Node.js tests without producing the HTML coverage report.

## Block transparency

The block editor offers Opaque, Cutout, and Blended alpha modes, plus Outside
or Outside and inside face visibility. Cull faces removes covered boundaries
between voxels using the same block; disabling it keeps their directional
appearances.

Texture edits rescan affected block tiles and switch opaque/blend modes to
match their alpha. An explicitly selected Cutout mode is preserved. This
automatic scan can override an Opaque or Blended selection when its texture
does not match; use the renderer API directly when that policy must be fixed.

The scene uses weighted blended transparency through
[VoxelTransparencyRenderer](../../voxel-renderer/docs/api/core/VoxelTransparencyRenderer.md).
Overlapping colors are approximate, and each retained surface adds coverage.
Thumbnail previews use ordinary Three.js blending.

Block definitions now use `alphaMode`, `side`, and `alphaCutoff`.
Migrate saved `transparent: true` fields to `alphaMode: "blend"` before
loading older content. Layer `compositing` defaults to `"composite"`;
`"replace"` restores full-opacity cell replacement.

## Contributors Guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

New features and bug fixes must include tests.

## License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../../CONTRIBUTING.md
[voxel-renderer]: ../../voxel-renderer/README.md
