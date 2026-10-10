# Assets in the engine

The engine consumes the platform-agnostic types from `@jolly-pixel/asset`.
Scenes declare what they need, `SceneManager` owns replacement and additive
load requests and loads them through the world's `AssetCoordinator`, and a
loader performs the I/O. ECS lifecycle methods stay synchronous.

## Declaring scene assets

Create references from stable IDs and the engine asset types, then pass them to
the scene constructor:

```ts
import {
  AssetReference,
  type AssetReferenceGroup
} from "@jolly-pixel/asset";
import {
  ActorComponent,
  AssetTypes,
  Systems
} from "@jolly-pixel/engine";

class KnightBehavior extends ActorComponent {
  static readonly assets = {
    model: new AssetReference(
      "model.knight",
      AssetTypes.model
    )
  } satisfies AssetReferenceGroup;

  override awake(): void {
    const model = this.getAsset(KnightBehavior.assets.model);
    // Use the prepared model synchronously.
  }
}

class BattleScene extends Systems.Scene {
  constructor() {
    super("battle", {
      assets: [KnightBehavior.assets]
    });
  }
}
```

`Scene.assets` is declarative data. `SceneManager.loadScene()` and
`SceneManager.appendScene()` create a `SceneLoad` that tracks readiness and
progress. `SceneManager` prepares those references through
`world.assetCoordinator`, then activates the scene at a frame boundary.

`SceneOptions.assets` accepts individual references and named reference groups.
Groups are flattened once into the scene's immutable `assets` array.

## Using a reference in a component

Built-in model and text renderers accept typed references instead of paths:

```ts
actor.addComponent(ModelRenderer, {
  asset: KnightBehavior.assets.model
});
```

`ActorComponent.getAsset(reference)` reads the prepared value synchronously.
The runtime completes the scene batch before `awake()`, so component lifecycle
methods do not perform asynchronous work. A missing prepared value throws
`AssetNotReadyError`, which exposes an orchestration error instead of starting
an implicit load inside the ECS lifecycle.

## Built-in types and loaders

| Type | Kind | Loader | Supported source |
| ---- | ---- | ------ | ---------------- |
| `AssetTypes.model` | `model` | `AssetLoaders.model` | OBJ, FBX, glTF, GLB (including `EXT_meshopt_compression`) |
| `AssetTypes.font` | `font` | `AssetLoaders.font` | Three.js typeface JSON |
| `AUDIO_ASSET` | `audio` | `AudioAssetLoader` | Formats supported by `THREE.AudioLoader` |
| `TEXTURE_ASSET` | `texture` | `TextureAssetLoader` | Formats supported by `THREE.TextureLoader`, plus KTX2 (see below) |

`createDefaultAssetLoaders(manager, options?)` returns an `AssetLoaderRegistry`
holding these loaders, all sharing the given Three.js `LoadingManager`. The
runtime starts from it and registers custom loaders on top.

```ts
const loaders = createDefaultAssetLoaders(new THREE.LoadingManager());
const coordinator = new AssetCoordinator({
  catalog,
  loaders
});
```

### KTX2 textures

`TextureAssetLoader` sends `.ktx2` sources to the `ktx2` option, any object
with `loadAsync(url): Promise<THREE.CompressedTexture>` (a
`CompressedTextureLoader`). Without it, loading a `.ktx2` source rejects. The
same `filter` and `colorSpace` apply to both paths.

```ts
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";

const ktx2 = new KTX2Loader(manager)
  .setTranscoderPath("/basis/")
  .detectSupport(renderer);
const loaders = createDefaultAssetLoaders(manager, { ktx2 });
```

The transcoder path serves `basis_transcoder.js` and `basis_transcoder.wasm`
from `three/examples/jsm/libs/basis/`. `detectSupport()` needs an initialized
renderer. The caller owns the loader and calls `ktx2.dispose()` when done.
`Runtime` does this for you through
[`assets.ktx2`](../../runtime/docs/api/runtime-assets.md#ktx2-textures).

## Responsibility boundary

- `@jolly-pixel/asset` owns IDs, catalogs, references, handles, stores, and batches.
- `@jolly-pixel/engine` owns the built-in loaders, loads scene assets through the world's coordinator, and reads prepared handles synchronously.
- `@jolly-pixel/runtime` resolves the catalog, composes the coordinator, and loads startup assets.

See the [`@jolly-pixel/asset` README](../../asset/README.md) for the catalog
format and lower-level APIs.
