<p align="center">
  <img src="./docs/banner.png" alt="JollyPixel">
</p>

## ⚙️ Requirements
- [Node.js](https://nodejs.org/en/) version 24 or higher
- [pnpm](https://pnpm.io/) v12+ for workspaces (the repository pins it through the `packageManager` field)

## 🧭 Workspaces

Every workspace name below drops the `@jolly-pixel/` scope: `network` is `@jolly-pixel/network`. Workspaces are grouped by sub-domain. Each arrow shows what one sub-domain provides to another.

<p align="center">
  <img src="./docs/context_map.png" alt="JollyPixel">
</p>

### 🤝 Collaboration

- [network](./packages/network) - Rooms, peers and state sync for the collaborative editors
- [accounts](./packages/accounts) - User accounts and session tokens for JollyPixel servers
- [history](./packages/history) - Command documents and per-person undo history that survives collaboration

### 🎨 Authoring

#### Shell

- [studio](./packages/studio) - One project, its assets and one editor per tab
- [editor.host](./packages/editors/host) - Shared launch, session and runtime boot for the editors
- [preferences](./packages/preferences) - Preference scopes, validation and overrides for the studio and the editors

#### Editors and formats

Each editor is an `editor.<name>` workspace, and the formats it owns (the asset kinds it reads and writes, and that `asset-server` stores) live in `asset.<name>` workspaces linked from each extension. Editors also read the formats their documents link, such as the `.pixelart` textures used by voxel maps and models.

- [Voxel map](./packages/editors/voxel-map) - Voxel-terrain editor for [`.voxelmap.json` worlds and `.blockset.json` blocksets](./packages/assets/voxel-map)
- [Voxel model](./packages/editors/voxel-model) - Low-polygon 3D model editor for [`.voxelmodel.json` models](./packages/assets/voxel-model) and [`.voxelanim.json` animation sets](./packages/assets/voxel-animation)
- [Pixel art](./packages/editors/pixel-art) - Pixel-art texture editor for [`.pixelart` textures](./packages/assets/pixel-art), built on `pixel-draw.renderer`
- [Terrain](./packages/editors/terrain) 🚧 - Heightfield terrain editor for [`.terrain.json` terrains](./packages/assets/terrain)
- [Scene](./packages/editors/scene) 🚧 - Actors, components and environment, saved as [`.scene.json` scenes](./packages/assets/scene)

#### UI

- [ui](./packages/ui) - Design system (declarative UI components and a facade API)
- [resize-handle](./packages/resize-handle) - Resize handles and splitters
- [console](./packages/console) - Command palette and developer console for the editors
- [lantern](./packages/lantern) - Guided tours for the editors

### 🗄️ Asset Management

- [asset](./packages/asset) - Asset references, catalogs and loading orchestration for browser and Node.js
- [asset-server](./packages/asset-server) - Event-sourced asset projection, reconciliation and catalog delivery
- [asset-source](./packages/asset-source) - Physical asset storage (filesystem, memory, IndexedDB)
- [event-store](./packages/event-store) - Append-only event log (event sourcing)

### 🏗️ Build

Planned. It will turn a project's assets into the catalog manifest the runtime loads.

### 🎮 Runtime

#### Core

- [runtime](./packages/runtime) - Game runtime for web browsers and Electron
- [engine](./packages/engine) - Minimal ECS framework on top of Three.js
- [loop](./packages/loop) - Frame scheduling and time primitives (FrameScheduler, GameLoop)
- [controls](./packages/controls) - Input controls (screen, mouse, touchpad, keyboard, gamepad)

#### Renderers

- [voxel.renderer](./packages/voxel-renderer) - Voxel engine and renderer
- [terrain.renderer](./packages/terrain-renderer) - Heightfield terrain engine and renderer 🚧
- [pixel-draw.renderer](./packages/pixel-draw-renderer) - Pixel-art canvas drawing and rendering

## 🧩 Shared libraries

Generic packages used by more than one sub-domain.

- [three](./packages/three) - Three.js components and utilities (grid, transform controls, selection highlight...)
- [color](./packages/color) - Color parsing, palettes, color spaces and conversions
- [image](./packages/image) - PNG codecs and browser raster decoding

## 🛠️ Tooling

- [bench](./packages/bench) - Benchmarking harness and CLI
- [e2e](./packages/e2e) - Playwright config, locators and editor fixtures for e2e suites

## 💃 Getting started

Public packages are published on npm and can be installed with [npm](https://docs.npmjs.com/getting-started/what-is-npm) or [yarn](https://yarnpkg.com). The studio, editors, formats, tooling and 🚧 renderers are private workspaces.

```bash
$ npm i @jolly-pixel/engine
# or
$ yarn add @jolly-pixel/engine
```

### Build
To install and compile all workspaces, just run the following command at the root

```bash
$ pnpm install
$ pnpm run build
```

### Run
[studio](./packages/studio) is the full application

```bash
$ pnpm --filter @jolly-pixel/studio dev
```

### Test
Run tests for one workspace, then run the repository type checks:

```bash
$ pnpm --filter <workspace> test
$ pnpm run typecheck
```

### Linter
Lint all workspaces with oxlint (the script also checks package exports and CSS):

```bash
$ pnpm run lint
```

## 📦 Publishing package
Each public package has its own `prepublishOnly` script that builds the TypeScript source before publishing.

```bash
$ pnpm publish --filter <workspace>
```

## Contributors ✨

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-4-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/fraxken"><img src="https://avatars.githubusercontent.com/u/4438263?v=4?s=100" width="100px;" alt="Thomas.G"/><br /><sub><b>Thomas.G</b></sub></a><br /><a href="https://github.com/JollyPixel/editor/commits?author=fraxken" title="Code">💻</a> <a href="https://github.com/JollyPixel/editor/commits?author=fraxken" title="Documentation">📖</a> <a href="https://github.com/JollyPixel/editor/issues?q=author%3Afraxken" title="Bug reports">🐛</a> <a href="https://github.com/JollyPixel/editor/commits?author=fraxken" title="Tests">⚠️</a> <a href="#security-fraxken" title="Security">🛡️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/AlexandreMalaj"><img src="https://avatars.githubusercontent.com/u/32218832?v=4?s=100" width="100px;" alt="Alexandre Malaj"/><br /><sub><b>Alexandre Malaj</b></sub></a><br /><a href="https://github.com/JollyPixel/editor/commits?author=AlexandreMalaj" title="Code">💻</a> <a href="https://github.com/JollyPixel/editor/commits?author=AlexandreMalaj" title="Documentation">📖</a> <a href="https://github.com/JollyPixel/editor/issues?q=author%3AAlexandreMalaj" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/PierreDemailly"><img src="https://avatars.githubusercontent.com/u/39910767?v=4?s=100" width="100px;" alt="PierreDemailly"/><br /><sub><b>PierreDemailly</b></sub></a><br /><a href="https://github.com/JollyPixel/editor/commits?author=PierreDemailly" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://blog-clement-gombauld.vercel.app/"><img src="https://avatars.githubusercontent.com/u/91478082?v=4?s=100" width="100px;" alt="Clement Gombauld"/><br /><sub><b>Clement Gombauld</b></sub></a><br /><a href="https://github.com/JollyPixel/editor/commits?author=clemgbld" title="Code">💻</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

## 📃 License
MIT
