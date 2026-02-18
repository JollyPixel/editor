# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JollyPixel Editor is a monorepo for a collaborative 3D HTML5 game maker. It provides an ECS framework on Three.js, a browser/Electron runtime, editor tools, and an MCP server exposing the engine to LLMs.

## Build & Development Commands

```bash
npm install              # Install all workspace dependencies
npm run build            # Build all packages (tsc)
npm run test             # Run tests across all packages
npm run lint             # ESLint all packages (npx eslint packages)
npm run clear            # Clear TypeScript build artifacts

# Per-package (use -w flag)
npm run test -w @jolly-pixel/engine
npm run test -w @jolly-pixel/runtime
npm run test-only -w @jolly-pixel/engine   # Skip coverage

# Single test file (run from package directory)
node --test test/Actor.spec.ts

# Vite dev servers (editors/experimental)
npm run dev -w @jolly-pixel/experimental
npm run dev -w @jolly-pixel/editor.voxel-map

# Changesets
npx changeset            # Create a changeset
npm run ci:version        # Apply version bumps
npm run ci:publish        # Publish to npm
```

## Testing

- **Framework**: Node.js built-in `node:test` with `node:assert` (strict mode)
- **Coverage**: `c8` with HTML reporter
- **Transpilation**: `tsx` for running .ts tests directly
- **DOM mocking**: `happy-dom`
- **Test files**: `*.spec.ts` (engine, runtime) or `*.test.ts` (fs-tree, voxel-map) in `test/` directories
- **Shared mocks**: `test/mocks.ts` provides factories like `createWorld()`, `createActor()`

## Monorepo Structure

```
packages/
  engine/         @jolly-pixel/engine      – ECS framework on Three.js (public)
  runtime/        @jolly-pixel/runtime     – Browser/Electron runtime (public)
  fs-tree/        @jolly-pixel/fs-tree     – Filesystem tree + live sync (private)
  mcp-server/     @jolly-pixel/mcp-server  – MCP server for LLM integration (private)
  experimental/   @jolly-pixel/experimental – Playground (private)
  editors/
    voxel-map/    @jolly-pixel/editor.voxel-map – Voxel map editor (private)
    model/        @jolly-pixel/editor.model     – 3D model editor/Electron (private)
```

Library packages (engine, runtime) compile with `tsc`. Editor/frontend packages use Vite.

## Architecture

### ECS Pattern

- **Actor** (Entity): Wraps `THREE.Group`, holds `Component[]`, has `Transform`, supports hierarchical tree
- **ActorComponent** (Component): Base class with lifecycle methods `awake()`, `start()`, `update(dt)`, `fixedUpdate(dt)`, `destroy()`. Extends `EventEmitter`
- **Behavior**: Extends `ActorComponent` for scripting logic. Supports typed `BehaviorProperties` via decorators
- **World**: Top-level container holding Renderer, SceneManager, Input, GlobalAudio, and typed context. Drives the update loop
- **SceneManager**: Manages the actor tree and runs lifecycle phases each frame
- **ActorTree**: Hierarchical container with glob-based (`getActors("Enemy_*")`) and path-based (`getActor("Player/RightHand/Weapon")`) lookups

### Lifecycle Order

```
awake() → start() → update(dt) / fixedUpdate(dt) → destroy()
```

SceneManager processes: pending awakes → pending starts → updates → fixed updates → pending destroys.

### Fixed Timestep (`FixedTimeStep`)

Accumulator pattern separating fixed-rate logic from variable-rate rendering. Default 60 FPS. Used by Runtime: `fixedUpdate` drives `World.update()`, `update` drives `World.render()`.

### Decorators (reflect-metadata)

- `@SceneProperty(options)` — marks Behavior property as editor-editable
- `@SceneActorComponent(class)` — marks property as referencing an actor component

### Runtime (`@jolly-pixel/runtime`)

High-level wrapper: creates canvas, renderer, world, and game loop. `loadRuntime()` handles GPU detection, loading screen (Lit web component), asset autoloading, and starts the loop.

## Coding Standards

### Imports — mandatory ordering with comments

```ts
// Import Node.js Dependencies
import fs from "node:fs/promises";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { Actor } from "./Actor.ts";
```

- Always use `node:` prefix for Node.js built-ins
- Include `.ts` file extensions in all internal imports
- Use `import type { ... }` for type-only imports (`verbatimModuleSyntax: true`)

### Naming

| Kind | Convention | Example |
|---|---|---|
| Classes, Interfaces, Types | `PascalCase` | `class HttpServer` |
| Variables, Functions, Methods | `camelCase` | `const fetchData` |
| Private class fields | `#prefix` | `#connectionPool` |
| Exported constants | `ALL_CAPS` | `export const API_URL` |
| File-local constants | `kPascalCase` | `const kTimeoutMs` |
| Type parameters | `T` prefix | `TData`, `TContext` |
| Unused params | `_` prefix | `_unused` |

### Style Rules

- Double quotes, semicolons always, strict equality (`===`/`!==`)
- `const` by default, `let` when reassigned, never `var`
- Comments on preceding line, never inline end-of-line
- Always add blank line before `return` statements
- No space between `async` and `()`: `async() => {}`
- Prefer `type` for unions/mapped types; `interface` for extendable shapes
- Avoid `enum`; use `as const` or union literal types
- Custom errors: extend `Error` with PascalCase names, optional `cause`
- Constants go directly beneath imports under a `// CONSTANTS` comment
