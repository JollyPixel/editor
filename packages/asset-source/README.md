<h1 align="center">
  asset-source
</h1>

<p align="center">
  Physical asset storage
</p>

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/asset-source
# or
$ yarn add @jolly-pixel/asset-source
```

## 👀 Usage example

```ts
import {
  FilesystemAssetSource
} from "@jolly-pixel/asset-source";

const source = new FilesystemAssetSource("./assets");

const bytes = new TextEncoder().encode("grass texture");
await source.write(
  "textures/grass.png",
  bytes
);
```

`AssetSource` stores bytes under root-relative POSIX paths. Its four common
operations read, write, delete and list assets. Both built-in sources normalize
path separators and reject paths that escape their root.

## 📚 API

- [`AssetSource`](./docs/AssetSource.md): shared storage contract and path rules
- [`Memory`](./docs/Memory.md): isolated in-process storage
- [`Filesystem`](./docs/Filesystem.md): persistent Node.js storage
- [`Utilities`](./docs/Utilities.md): path, state-directory and JSON helpers

## ✨ Contributors guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Run these commands from the monorepo root:

```bash
$ npm run test -w @jolly-pixel/asset-source
$ npm run lint
```

> [!CAUTION]
> In case you introduce a new feature or fix a bug, make sure to include tests for it as well.

## 📃 License

MIT

<!-- Reference-style links for DRYness -->

[npm]: https://docs.npmjs.com/getting-started/what-is-npm
[yarn]: https://yarnpkg.com
[contributing]: ../../CONTRIBUTING.md
