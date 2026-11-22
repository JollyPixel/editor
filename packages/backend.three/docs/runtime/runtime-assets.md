# Runtime asset options

`RuntimeAssetOptions` selects the catalog and adds browser asset loaders to the
coordinator owned by a [`Runtime`](./Runtime.md).

## API

```ts
type RuntimeAssetCatalog = AssetCatalog | string | URL;

interface RuntimeAssetOptions {
  readonly catalog?: RuntimeAssetCatalog;
  readonly loaders?: Iterable<ThreeAssetLoaderDefinition>;
  readonly ktx2?: RuntimeKTX2Options;
}

interface RuntimeKTX2Options {
  readonly transcoderPath: string;
}

type ThreeAssetLoaderDefinition<TValue = unknown> =
  Systems.AssetLoaderDefinition<THREE.LoadingManager, TValue>;

type ThreeComponentPackage = Systems.ComponentPackage<THREE.LoadingManager>;
```

`Systems.AssetLoaderDefinition` and `Systems.ComponentPackage` come from
`@jolly-pixel/ecs`. A package's `RUNTIME_COMPONENTS` is typed
`ThreeComponentPackage` when its loaders build on the runtime's
`LoadingManager`.

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

Runtime starts from the [`createDefaultAssetLoaders()`](../assets.md#built-in-types-and-loaders) registry: the
model, font, audio, texture, and scene file loaders. Each custom definition receives the same Three.js `LoadingManager` available as
`runtime.manager`.

A custom definition that uses an already registered asset type causes runtime
construction to reject. See [custom asset loaders](../guides/custom-asset-loaders.md)
for a complete setup.


## KTX2 textures

Set `ktx2` to load `.ktx2` sources through `TEXTURE_ASSET`. On the first
`.ktx2` load, the runtime imports `KTX2Loader`, builds one on
`runtime.manager` and calls `detectSupport()` on its renderer. Later loads
share it, and `runtime.dispose()` disposes it. Without `ktx2`, loading a
`.ktx2` texture rejects.

`transcoderPath` is the URL of a directory serving `basis_transcoder.js` and
`basis_transcoder.wasm`, copied from `three/examples/jsm/libs/basis/`. The
transcoder is fetched on the first `.ktx2` load.

```ts
const runtime = await Runtime.create("canvas", {
  assets: {
    catalog: new URL("assets.json", document.baseURI),
    ktx2: {
      transcoderPath: "/basis/"
    }
  }
});
```
