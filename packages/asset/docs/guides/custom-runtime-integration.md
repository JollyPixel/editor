# Custom runtime integration

Use the orchestration API directly when building a platform runtime, editor
tool, test harness, or server-side asset pipeline. JollyPixel game projects can
normally rely on `@jolly-pixel/runtime` instead.

## Compose the loading system

Define one shared `AssetType` token for each kind. Register its loader, then
construct a coordinator from the registry and catalog:

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
```

The same `MODEL_ASSET` object must be used to create references and register
the loader. Recreating `new AssetType<Model>("model")` with the same kind does
not satisfy token identity checks.

## Load behind an asynchronous boundary

`request()` creates a handle without starting I/O. A batch prepares the fixed
set of references needed by an operation:

```ts
const heroReference = new AssetReference(
  "hero-model",
  MODEL_ASSET
);
const hero = assets.request(heroReference);
const batch = assets.loadBatch([heroReference]);

await batch.done;

const model = hero.get();
```

Concurrent batches share the store's in-flight promise. Each batch still owns
its progress and failure state.

For one explicit dynamic asset, `load()` returns the value and accepts an
optional abort signal:

```ts
const controller = new AbortController();
const model = await assets.load(heroReference, {
  signal: controller.signal
});
```

The loader decides how to apply the signal. `loadBatch()` has no cancellation
option.

## Replace loaded content

Replacing a catalog record does not change a value already held by the store.
Evict it explicitly and dispose the returned platform resource when required:

```ts
catalog.replace(updatedRecord);

const value = assets.store.evict(updatedRecord.id);
disposeModel(value);
```

`evict()` and `clear()` remove store entries. They do not abort in-flight I/O
or dispose values.
