# Runtime asset options

`RuntimeAssetOptions` selects the catalog and adds browser asset loaders to the
coordinator owned by a [`Runtime`](./Runtime.md).

## API

```ts
type RuntimeAssetCatalog = AssetCatalog | string | URL;

interface RuntimeAssetOptions {
  readonly catalog?: RuntimeAssetCatalog;
  readonly loaders?: Iterable<RuntimeAssetLoaderDefinition>;
}

interface RuntimeAssetLoaderDefinition<TValue = unknown> {
  readonly type: AssetType<TValue>;

  create(
    manager: THREE.LoadingManager
  ): AssetLoader<TValue>;
}
```

## Catalog resolution

An omitted catalog creates an empty `AssetCatalog`. Passing an `AssetCatalog`
uses that instance directly. String and `URL` inputs are fetched and parsed
through `AssetCatalog.parse()` before the runtime is constructed.

An unsuccessful response rejects with an `Error` containing the catalog URL and
HTTP status. Network errors, JSON decoding errors, and manifest validation
errors propagate to the caller.

```ts
const runtime = await Runtime.create("canvas", {
  assets: {
    catalog: new URL("assets.json", document.baseURI)
  }
});
```

## Loaders

Runtime registers the engine's model, font, audio, and texture loaders. Each
custom definition receives the same Three.js `LoadingManager` available as
`runtime.manager`.

A custom definition that uses an already registered asset type causes runtime
construction to reject. See [custom asset loaders](../guides/custom-asset-loaders.md)
for a complete setup.

