<p align="center">
<img width="300" src="https://github.com/JollyPixel/.github/blob/main/logo.png?raw=true" alt="openally">
</p>

<p align="center">
  <h1 align="center">JollyPixel</h1>
</p>

<p align="center">
  Monorepo for the collaborative 3D HTML5 game maker
</p>

<p align="center">
  <a href="https://github.com/JollyPixel/editor">
    <img src="https://img.shields.io/github/license/JollyPixel/editor?style=for-the-badge" alt="license">
  </a>
  <a href="https://github.com/JollyPixel/editor">
    <img src="https://img.shields.io/maintenance/yes/2025?style=for-the-badge" alt="maintained">
  </a>
  <a href="https://github.com/JollyPixel/editor">
    <img src="https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript" alt="typescript">
  </a>
  <a href="https://github.com/JollyPixel/editor">
    <img src="https://img.shields.io/static/v1?&label=module&message=ESM%20and%20CJS&color=9cf&style=for-the-badge" alt="esm-cjs">
  </a>
</p>

## Requirements
- [Node.js](https://nodejs.org/en/) version 24 or higher
- npm v7+ for [workspaces](https://docs.npmjs.com/cli/v7/using-npm/workspaces)

## Available packages

Click on one of the links to access the documentation of the package:

| name | package and link | description |
| --- | --- | --- | 
| engine | [@jolly-pixel/engine](./packages/engine) | ECS framework on top of Three.js |
| runtime | [@jolly-pixel/runtime](./packages/runtime) | Runtime for the engine / ECS |

These packages are available in the Node Package Repository and can be easily installed with [npm](https://docs.npmjs.com/getting-started/what-is-npm) or [yarn](https://yarnpkg.com).
```bash
$ npm i @jolly-pixel/engine
# or
$ yarn add @jolly-pixel/engine
```

## Build
To install and compile all workspaces, just run the following command at the root

```bash
$ npm ci
$ npm run build
```

## Test
Running test with npm workspace:

```bash
$ npm run test -w <workspace>
```

## Publishing package
Each packages has his own `prepublishOnly` to build TypeScript source before publishing.

```bash
$ npm publish -w <workspace>
```

## Contributors ✨

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-6-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->


<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

## License
MIT
