# AGENTS.md

## Consumers

- `editor.pixel-art` and `editor.voxel-map` load this package from `dist/`.
  Run `pnpm run build` here before checking either editor.
- Unit tests draw on `skia-canvas`, not a hand-written 2D context mock.
