# AGENTS.md

three.js WebGPU gotchas live in `packages/three/AGENTS.md`.

## Consumers

- `assets/voxel-map` and the editors load this package from `dist/`, so their
  typecheck and tests read stale types until `pnpm run build` runs here.
- The examples resolve `@jolly-pixel/voxel.renderer` to `src/` through the
  `vite.config.ts` alias and `examples/tsconfig.json` `paths`. A new subpath
  imported by an example needs an entry in both, or `dist` and `src` classes
  clash.

## Testing

- Mesh worker specs run in-process over `MessageChannel` pairs
  (`test/helpers/meshWorkers.ts`). Dispose engines in `afterEach`, or open
  ports keep `node:test` alive.
