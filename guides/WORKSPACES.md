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
