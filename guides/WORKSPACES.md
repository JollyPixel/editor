# Workspaces

Use this checklist when adding a package under `packages/`. Start from the
closest existing workspace because published libraries, private packages, and
frontend applications use different manifests and scripts.

## Register the workspace

- Create the package under a path matched by `pnpm-workspace.yaml`:
  `packages/*`, `packages/assets/*`, or `packages/editors/*`. Add a workspace
  glob when using another location.
- Add the package path to the root `tsconfig.json` `references` array.
- Add the package to the root `README.md` under `Available packages`.

## Configure the package

- Extend `tsconfig/lib.json` from the package's `tsconfig.json`, using the
  correct relative path.
- Give `test/`, `bench/`, `examples/`, and `scripts/` their own `tsconfig.json`
  when present. Extend the package config first, followed by `tsconfig/test.json`
  for tests, `tsconfig/examples.json` for examples, or `tsconfig/check.json` for
  other directories. Include each config in the package's `typecheck` script.
- Declare every direct dependency in `package.json`. Use the `workspace:`
  protocol for internal packages and follow a comparable workspace when
  choosing the range. Add peer dependencies to `devDependencies` when local
  development or tests import them.
- When the package imports another workspace, add both the `package.json`
  dependency and a matching TypeScript project reference.
- Add `test`, `typecheck`, and `lint` scripts. Add `build` when the package emits
  output. For published packages, copy the publishing fields and
  `prepublishOnly` script from a comparable library.

## Declare entry points

Every published package declares `exports`, never `main` or `types`. Each
target is `{ "types": "./dist/<path>.d.ts", "default": "./dist/<path>.js" }`.
Private packages that ship no build may point a subpath at a `./src/*.ts` file
instead.

| Subpath | Holds | Examples |
|---|---|---|
| `.` | The main surface, safe in a browser whenever the package allows it | `@jolly-pixel/asset-source` |
| `./client`, `./server` | One side of a collaboration protocol | `@jolly-pixel/network/client`, `@jolly-pixel/asset.pixel-art/server` |
| `./node`, `./browser` | Code that needs Node.js builtins or the DOM | `@jolly-pixel/asset-server/node`, `@jolly-pixel/image/browser` |
| Named after an optional peer | An integration that imports an optional peer dependency | `@jolly-pixel/voxel.renderer/engine`, `@jolly-pixel/ui/network` |
| Named after a feature | A slice kept out of the root because the root registers custom elements, or because it is loaded lazily | `@jolly-pixel/ui/stats`, `@jolly-pixel/editor.host/offline` |

- Use lowercase names with no file extension and no wildcard. `pnpm run lint`
  runs `scripts/checkExports.ts`, which rejects other keys and targets with no
  source file.
- Add a subpath only when a consumer imports it. Export a new helper from the
  root and rely on tree-shaking instead of adding a subpath for it.
- Set `"sideEffects": false` when no module runs code on import that a
  consumer depends on. List the files that do, such as worker entry scripts,
  instead of omitting the field. Packages that register custom elements keep
  the default.

## Verify the workspace

Run from the repository root:

```sh
pnpm install
pnpm run build
pnpm --filter <workspace> test
pnpm run typecheck
pnpm run lint
```

For a published package, inspect the packed files as well:

```sh
pnpm --filter @jolly-pixel/<package-name> pack --dry-run
```
