# AssetLoader

`AssetLoader<TValue>` converts one catalog record into a runtime value. The
loader owns platform-specific I/O and decoding for `record.path`.

## API

```ts
interface AssetLoadOptions {
  signal?: AbortSignal;
}

interface AssetDependencies {
  readonly catalog: AssetCatalog;

  load<TValue>(
    reference: AssetReference<TValue>
  ): Promise<TValue>;
}

interface AssetLoadContext extends AssetLoadOptions {
  readonly assets: AssetDependencies;
}

interface AssetLoader<TValue = unknown> {
  load(
    record: AssetRecord,
    context: AssetLoadContext
  ): Promise<TValue>;
}
```

The asset package treats paths as opaque. A browser loader might fetch a URL,
while an editor loader can read a project path.

`context.signal` is optional. Supporting cancellation is the loader's
responsibility; the coordinator does not abort work automatically.

`context.assets` belongs to the coordinator that started the load. A loader
whose value needs another asset loads it there, and the coordinator keeps that
value like any other. `catalog` finds records the loader knows only by path.
Two loaders that wait on each other never settle: break a cycle before loading.

Register a loader with the same [`AssetType`](../domain/AssetType.md) used by
its references:

```ts
loaders.register(TEXT_ASSET, {
  async load(record, context) {
    const response = await fetch(record.path.toString(), {
      signal: context.signal
    });

    return response.text();
  }
});
```
