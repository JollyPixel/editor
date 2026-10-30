# Assets in the engine

Scenes declare the assets they need, `SceneManager` loads them through the
world's `AssetCoordinator` before the scene starts, and components read them
synchronously.

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

`SceneOptions.assets` accepts references and reference groups, flattened
into the scene's `assets`. [SceneManager](systems/scene-manager.md) loads
them before activating the scene.

## Using a reference in a component

Built-in model and text renderers accept typed references instead of paths:

```ts
actor.addComponent(ModelRenderer, {
  asset: KnightBehavior.assets.model
});
```

`ActorComponent.getAsset(reference)` reads the loaded value synchronously.
A value not loaded yet throws `AssetNotReadyError`; it never starts a load.

## Built-in types and loaders

| Type | Kind | Loader | Supported formats |
| ---- | ---- | ------ | ----------------- |
| `AssetTypes.model` | `model` | `AssetLoaders.model` | OBJ, FBX, glTF, GLB (including `EXT_meshopt_compression`) |
| `AssetTypes.font` | `font` | `AssetLoaders.font` | Three.js typeface JSON |
| `AUDIO_ASSET` | `audio` | `AudioAssetLoader` | Formats supported by `THREE.AudioLoader` |
| `TEXTURE_ASSET` | `texture` | `TextureAssetLoader` | Formats supported by `THREE.TextureLoader`, plus KTX2 (see below) |

`createDefaultAssetLoaders(manager, options?)` returns an `AssetLoaderRegistry`
holding these loaders, sharing one Three.js `LoadingManager`. The model loader
imports a format's three.js loader on the first file of that format.

```ts
const loaders = createDefaultAssetLoaders(new THREE.LoadingManager());
const coordinator = new AssetCoordinator({
  catalog,
  loaders
});
```

### KTX2 textures

`TextureAssetLoader` sends `.ktx2` paths to the `ktx2` option, any object
with `loadAsync(url): Promise<THREE.CompressedTexture>` (a
`CompressedTextureLoader`). Without it, loading a `.ktx2` path rejects. The
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
renderer. The caller disposes the loader; `@jolly-pixel/runtime` does it for
its `assets.ktx2` option.

Catalogs, references and handles come from `@jolly-pixel/asset`.
