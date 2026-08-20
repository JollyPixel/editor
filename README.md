<p align="center">
<img width="300" src="https://github.com/JollyPixel/.github/blob/main/logo.png?raw=true" alt="openally">
</p>

<p align="center">
  <h1 align="center">JollyPixel</h1>
</p>

<p align="center">
  The collaborative 3D HTML5 game maker
</p>

## Requirements
- [Node.js](https://nodejs.org/en/) version 24 or higher
- npm v7+ for [workspaces](https://docs.npmjs.com/cli/v7/using-npm/workspaces)

## Available packages

Click on one of the links to access the documentation of the package;

- [@jolly-pixel/engine](./packages/engine) - Entity Component System (ECS)
- [@jolly-pixel/controls](./packages/controls) - Input controls (Screen, Mouse, Touchpad, Keyboard, Gamepad)
- [@jolly-pixel/runtime](./packages/runtime) - Browser/Electron runtime
- [@jolly-pixel/asset](./packages/asset) - Platform-agnostic asset references and loading orchestration

We provide agnostic renderers and engines (often used by our editors below):

- [@jolly-pixel/voxel.renderer](./packages/voxel-renderer) - Voxel Engine
- [@jolly-pixel/pixel-draw.renderer](./packages/pixel-draw-renderer) - Pixel Art Canvas API

### Backend

- [@jolly-pixel/event-store](./packages/event-store) - Append-only log (Event Sourcing pattern)
- [@jolly-pixel/network](./packages/network) - Shared wire for multiplayer editors
- [@jolly-pixel/asset-server](./packages/asset-server) - Back-end asset orchestration: event-sourced projection, reconciliation and catalog delivery

### UI

- [@jolly-pixel/ui](./packages/ui) - Design System (declarative UI components + Facade API)
- [@jolly-pixel/arbor](./packages/arbor) - Stylable tree view widget with drag'n'drop support
- [@jolly-pixel/resize-handle](./packages/resize-handle) - Resize handles / splitters

### Utilities

- [@jolly-pixel/three](./packages/three) - Three.js utilities (Grid, Frustum, ...)
- [@jolly-pixel/color](./packages/color) - Color utilities (Parsing, Palettes, Color Spaces, Color Conversions ...)

### Editors

- [Voxel Map](./packages/editors/voxel-map/): 3D Voxel Terrain editor
- [Voxel Model](./packages/editors/voxel-model/): Low-poly/voxel 3D model editor
- [Pixel Art](./packages/editors/pixel-art/): 2D Pixel-Art texturing editor

---

These packages are available in the Node Package Repository and can be easily installed with [npm](https://docs.npmjs.com/getting-started/what-is-npm) or [yarn](https://yarnpkg.com).

```bash
$ npm i @jolly-pixel/engine
# or
$ yarn add @jolly-pixel/engine
```

## Build
To install and compile all workspaces, just run the following command at the root

```bash
$ npm install
$ npm run build
```

## Test
Running test with npm workspace:

```bash
$ npm run test -w <workspace>
```

## Linter
Running ESLint for all workspaces

```bash
$ npm run lint
```

## Publishing package
Each packages has his own `prepublishOnly` to build TypeScript source before publishing.

```bash
$ npm publish -w <workspace>
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

## License
MIT
