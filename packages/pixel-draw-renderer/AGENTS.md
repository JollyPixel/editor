# AGENTS.md

## Consumers

- `editor.pixel-art`, `editor.voxel-map`, `editor.voxel-model`, their asset
  packages and the studio load this package from `dist/`. Run
  `pnpm run build` here before checking any of them.
- Unit tests draw on `skia-canvas`, not a hand-written 2D context mock.
