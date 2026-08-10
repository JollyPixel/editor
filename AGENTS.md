# AGENTS.md

## Project Overview

JollyPixel Editor is a monorepo for a collaborative 3D HTML5 game maker (ECS framework on Three.js, browser/Electron runtime, editor tools). See [ARCHITECTURE.md](./ARCHITECTURE.md) for the repository layout.

## Essential Commands

```bash
npm install                                  # Install all workspace dependencies
npm run build                                # Build all packages that define "build" (tsc / vite build)
npm run test                                 # Run tests in all packages that define "test"
npm run lint                                 # ESLint all packages (npx eslint packages)
npm run clear                                # Clear TypeScript build artifacts

# Per-package (use -w flag — package name may differ from folder name, see below)
npm run test -w @jolly-pixel/engine
npm run test-only -w @jolly-pixel/engine     # Skip coverage
npm run dev -w @jolly-pixel/editor.voxel-map # Vite dev server

# Single test file (run from the package directory)
node --test test/Actor.spec.ts

# Changesets
npx changeset             # Create a changeset
npm run ci:version        # Apply version bumps
npm run ci:publish        # Publish to npm
```

## Tech Stack

- Node.js >= v24 built-in `node:test` with `node:assert` (strict mode)
- Language: TypeScript
- Package Manager: npm (always use npm)

## Testing Guidelines

- Write unit tests for all new functionality
- Mock external dependencies when appropriate (Make use of `happy-dom` library for DOM mocking)
- Ensure tests are deterministic and isolated
- `*.spec.ts` or `*.test.ts` always under `test/`
- For coverage make use of `c8` (HTML reporter), wired through each package's `test` script — use `test-only` to skip it

## Conventions

- Relative imports need an explicit `.ts` extension (never `.js`). The shared `tsconfig.base.json` (`@openally/config.typescript/esm-ts-next`) enforces `erasableSyntaxOnly` (no `enum`, no constructor parameter properties, no `namespace`/`module`) and `verbatimModuleSyntax` (type-only imports must use `import type`); `noImplicitAny` is deliberately off while the rest of `strict` is on.
- `.npmrc` sets `ignore-scripts=true` and `package-lock=false`: a plain `npm install` won't run lifecycle scripts or write a lockfile. CI mirrors this (`npm install --ignore-scripts`).
- Only one ESLint config exists, at the root (`eslint.config.mjs`), covering every workspace.
- Run linting for all new functionality
- Update API (markdown) documentation
- Never use git or commit by yourself
- When creating changeset file for release, make sure to keep them minimal (2 to 3 lines max)

## Coding Standards

See [.github/CODE_STYLE.md](./.github/CODE_STYLE.md) for import ordering, naming conventions, and style rules — read it before writing or editing code in this repo.
