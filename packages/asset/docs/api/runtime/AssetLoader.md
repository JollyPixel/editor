# AssetLoader

`AssetLoader<TValue>` converts one catalog record into a runtime value. The
loader owns platform-specific I/O and decoding for `record.source`.

## API

```ts
interface AssetLoadContext {
  signal?: AbortSignal;
}

interface AssetLoader<TValue = unknown> {
  load(
    record: AssetRecord,
    context: AssetLoadContext
  ): Promise<TValue>;
}
```

The asset package treats sources as opaque. A browser loader might fetch a URL,
while an editor loader can read a project path.

`context.signal` is optional. Supporting cancellation is the loader's
responsibility; the coordinator does not abort work automatically.

Register a loader with the same [`AssetType`](../domain/AssetType.md) used by
its references:

```ts
loaders.register(TEXT_ASSET, {
  async load(record, context) {
    const response = await fetch(record.source, {
      signal: context.signal
    });

    return response.text();
  }
});
```
