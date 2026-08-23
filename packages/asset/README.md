<h1 align="center">
  asset
</h1>

<p align="center">
  Asset references, catalogs, and loading orchestration for browser and Node.js
</p>

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/asset
# or
$ yarn add @jolly-pixel/asset
```

## 💡 About 

An asset keeps the same identity when its file, URL, or revision changes.
Scenes and components store an `AssetReference`. An `AssetCatalog` resolves
that reference to an `AssetRecord`, which describes the current source and
revision.

Choose the path that matches your work:

- Game developers using `@jolly-pixel/runtime` should start with
  [using assets in a game](./docs/guides/using-assets-in-a-game.md).
- Runtime, editor, and server maintainers should read
  [runtime loading architecture](./docs/concepts/runtime-loading-architecture.md)
  and [custom runtime integration](./docs/guides/custom-runtime-integration.md).

The [asset glossary](./GLOSSARY.md) defines the terms shared by these APIs.

## 👀 Usage example

Create a reference with one of the engine's shared asset types, then declare it
as a scene dependency:

```ts
import { AssetReference } from "@jolly-pixel/asset";
import {
  AssetTypes,
  ModelRenderer,
  Systems
} from "@jolly-pixel/engine";

const heroModel = new AssetReference(
  "hero-model",
  AssetTypes.model
);

class GameScene extends Systems.Scene {
  constructor() {
    super("game", {
      assets: [heroModel]
    });
  }

  override awake(): void {
    this.world.createActor("hero")
      .addComponent(ModelRenderer, {
        asset: heroModel
      });
  }
}
```

The JollyPixel runtime loads `scene.assets` before activating the scene. The
catalog supplies the source for `"hero-model"`; gameplay code keeps the stable
reference. The [game developer guide](./docs/guides/using-assets-in-a-game.md)
shows the matching catalog and runtime setup.

## 📚 API

### Core model

Start here. These types define persistent asset identity and catalog lookup.

- [`AssetReference`](./docs/api/core/AssetReference.md): the stable, typed value
  stored by scenes and components.
- [`AssetCatalog`](./docs/api/core/AssetCatalog.md): the authoritative records
  for one project or session.

### Supporting domain types

- [`AssetId`](./docs/api/domain/AssetId.md): validated stable identity.
- [`AssetType`](./docs/api/domain/AssetType.md): the shared token connecting a
  persistent kind to its loaded value type.
- [`AssetRecord`](./docs/api/domain/AssetRecord.md): source and revision metadata
  held by a catalog.

### Runtime orchestration

These APIs are primarily for runtime integrations, editor tools, and explicit
dynamic loading.

- [`AssetCoordinator`](./docs/api/runtime/AssetCoordinator.md): resolves
  references and starts loads.
- [`AssetLoader`](./docs/api/runtime/AssetLoader.md) and
  [`AssetLoaderRegistry`](./docs/api/runtime/AssetLoaderRegistry.md): produce
  runtime values for registered asset types.
- [`AssetStore`](./docs/api/runtime/AssetStore.md) and
  [`AssetHandle`](./docs/api/runtime/AssetHandle.md): own and expose runtime
  state.
- [`AssetLoadBatch`](./docs/api/runtime/AssetLoadBatch.md): tracks one fixed
  loading operation.

The reference also covers [package errors](./docs/api/errors.md) and the
[room-name and URL helpers](./docs/api/integration-utilities.md) shared with
server and collaboration packages.

## ✨ Contributors guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Once you have finished your development, check that the tests (and linter) are still good by running the following script:

```bash
npm run test -w @jolly-pixel/asset
npm run lint
```

> [!CAUTION]
> In case you introduce a new feature or fix a bug, make sure to include tests for it as well.

## 📃 License

MIT

<!-- Reference-style links for DRYness -->

[npm]: https://docs.npmjs.com/getting-started/what-is-npm
[yarn]: https://yarnpkg.com
[contributing]: ../../CONTRIBUTING.md
