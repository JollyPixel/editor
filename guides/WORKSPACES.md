# Workspaces guide

This guide covers creating and maintaining pnpm workspaces in the JollyPixel
Editor monorepo. It assumes basic familiarity with pnpm, Node.js, and TypeScript
project references.

## Create a workspace

Create the package directory under `packages/`. Packages can be nested when it
makes the repository easier to navigate; the editor packages live in
`packages/editors/`, for example.

`pnpm-workspace.yaml` matches `packages/*`, `packages/assets/*` and
`packages/editors/*`, so a package placed in one of those directories is picked
up with no registration. Anywhere else, add its glob to the `packages` list.
Add the package's path to the root `tsconfig.json` `references` array either way.

Also update:

- `README.md`, in the `Available packages` section, with a short description.

The root `tsconfig.json` reference includes the package in repository-wide
TypeScript builds. Dependencies between packages belong in the new package's
own `tsconfig.json` `references` array. TypeScript follows that dependency graph;
the order of root references is not a dependency declaration.

The root build command runs each workspace's `build` script through `pnpm -r`,
which orders them by the workspace dependency graph. Declaring the dependency in
`package.json` is what sets the build order.

## Package contents

Most library packages contain the following directories and files:

- `src/` for source code.
- `test/` for unit tests.
- `docs/` for package documentation.
- `package.json` and `tsconfig.json`.
- `README.md` and `LICENSE` when the package is published independently.

These are conventions, not every package needs every directory. Keep the
published package focused on its public API and document that API in its README
and `docs/` directory when it needs more detail.

### Frontend packages

This repository uses Vite for frontend development and `node:test` for tests.
Do not add a Vitest configuration by default.

A frontend package may need:

- `vite.config.ts` for the development server and build.
- `index.html`, or an `examples/` directory configured as Vite's root.
- `test/setup.ts` when tests need a DOM environment such as `happy-dom`.
- `examples/` for a standalone demo or development application.

## README.md

Use an existing package README as a reference. A publishable library README
normally describes installation, a short usage example, its public API, how to
contribute, and licensing. Add badges or a logo only when they provide useful
information for that package.

## package.json

Start a publishable TypeScript library with a manifest like this, then add only
the fields it needs:

```json
{
  "name": "@jolly-pixel/<package-name>",
  "description": "<description>",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "prepublishOnly": "rimraf ./dist && tsc -b",
    "build": "tsc -b",
    "test-only": "node --test \"test/**/*.spec.ts\"",
    "test": "c8 -r html pnpm run test-only"
  },
  "publishConfig": {
    "registry": "https://registry.npmjs.org",
    "access": "public",
    "provenance": true
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/JollyPixel/editor.git",
    "directory": "packages/<package-path>"
  },
  "files": [
    "dist"
  ],
  "directories": {
    "doc": "docs",
    "test": "test"
  },
  "author": "<author>",
  "license": "MIT"
}
```

For runtime dependencies on another workspace, add its package name with the
`workspace:` protocol: `"@jolly-pixel/asset": "workspace:*"` in `dependencies`
and `devDependencies`, `"workspace:^"` in `peerDependencies`. pnpm refuses to
resolve those from the registry, and replaces the range with a concrete version
when the package is packed or published. The package name need not match its
directory name. Use `peerDependencies` for libraries that require the consumer to
provide a shared dependency, and add that dependency to `devDependencies` too
when the package needs it for local development or tests.

Declare every package a workspace imports, including dev tooling. pnpm's
`node_modules` is isolated, so a dependency that is only reachable transitively
will not resolve.

Install dependencies from the repository root. `pnpm-workspace.yaml` pins exact
versions, denies dependency build scripts, blocks exotic transitive sources and
enforces a three-day release cooldown.

## tsconfig.json

For a package directly under `packages/`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": [
    "src"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
```

A nested package must use the appropriate relative path. For example,
`packages/editors/my-editor/tsconfig.json` extends
`../../../tsconfig.base.json`.

When the package imports another workspace, add a matching project reference:

```json
{
  "references": [
    {
      "path": "../dependency-package"
    }
  ]
}
```

The relative path is from the package's own `tsconfig.json`. This reference and
the dependency in `package.json` serve different purposes, so add both.

## Verify the new workspace

From the repository root, run:

```sh
pnpm install
pnpm run build
pnpm run test
pnpm run lint
```

For a publishable package, run
`pnpm pack --filter @jolly-pixel/<package-name> --dry-run` as well. Confirm that the tarball contains the intended `dist/` output and no
unwanted source or test artifacts.
