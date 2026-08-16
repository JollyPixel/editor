<h1 align="center">
  asset
</h1>

<p align="center">
  Platform-agnostic asset references and loading orchestration for browser and Node.js runtimes
</p>

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/asset
# or
$ yarn add @jolly-pixel/asset
```

## 🧭 Mental model

An asset keeps the same identity when its file, URL, or revision changes.
Scenes and components store an `AssetReference`, which contains that stable
identity and the expected asset type. The `AssetCatalog` resolves the
reference to an `AssetRecord` that says where the content comes from.

At runtime, an `AssetLoader` turns the record into a usable value. The
`AssetStore` owns that value and any load already in progress, while an
`AssetHandle` provides synchronous access once loading has finished. An
`AssetLoadBatch` groups the references needed for one operation, such as
runtime startup or a future scene transition.

A runtime decides when an ECS world starts and when a scene becomes active.
This package supplies the loading boundary it can await before entering
synchronous lifecycle code.

See the [glossary](./GLOSSARY.md) for the shared domain vocabulary.

## 👀 Usage example

```ts
import {
  AssetCatalog,
  AssetCoordinator,
  AssetLoaderRegistry,
  AssetRecord,
  AssetReference,
  AssetType
} from "@jolly-pixel/asset";

interface Model {
  readonly source: string;
}

const MODEL_ASSET = new AssetType<Model>("model");
const catalog = new AssetCatalog([
  new AssetRecord({
    id: "hero-model",
    kind: "model",
    source: "project:/models/hero.glb"
  })
]);

const loaders = new AssetLoaderRegistry();
loaders.register(MODEL_ASSET, {
  async load(record) {
    return {
      source: record.source
    };
  }
});

const assets = new AssetCoordinator({
  catalog,
  loaders
});
const heroReference = new AssetReference("hero-model", MODEL_ASSET);
const hero = assets.request(heroReference);
const batch = assets.loadBatch([
  heroReference
]);

await batch.done;

// ECS lifecycle methods can read the value synchronously after the barrier.
const model = hero.get();
```

> [!NOTE]
> `MODEL_ASSET` ties the persistent `"model"` kind to the `Model` value returned by its loader.

## 📚 API

- [Glossary](./GLOSSARY.md): domain vocabulary and naming boundaries.
- [AssetReference](./docs/AssetReference.md): stable IDs, typed kinds, and scene persistence.
- [AssetCatalog](./docs/AssetCatalog.md): records, sources, revisions, and manifests.
- [AssetCoordinator](./docs/AssetCoordinator.md): loaders, runtime storage, and handles.
- [AssetLoadBatch](./docs/AssetLoadBatch.md): independent loading operations and progress.

## ✨ Contributors guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Once you have finished your development, check that the tests and linter are still good by running the following scripts from the repository root:

```bash
$ npm run test -w @jolly-pixel/asset
$ npm run lint
```

> [!CAUTION]
> New behavior and bug fixes require tests.

## 📃 License

MIT

<!-- Reference-style links for DRYness -->

[npm]: https://docs.npmjs.com/getting-started/what-is-npm
[yarn]: https://yarnpkg.com
[contributing]: ../../CONTRIBUTING.md
