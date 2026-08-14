# Assets in the engine

The engine consumes the platform-agnostic types from `@jolly-pixel/asset`.
Scenes declare what they need, `SceneManager` owns replacement and additive
load requests, and a platform loader performs the I/O. ECS lifecycle methods
stay synchronous.

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
progress. The runtime prepares those references, then `SceneManager` activates
the scene at a frame boundary.

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
| `AssetTypes.model` | `model` | `AssetLoaders.model` | OBJ, FBX, glTF, GLB |
| `AssetTypes.font` | `font` | `AssetLoaders.font` | Three.js typeface JSON |
| `AUDIO_ASSET` | `audio` | `AudioAssetLoader` | Formats supported by `THREE.AudioLoader` |

The runtime registers these browser loaders by default. A custom
`AssetLoaderRegistry` can replace that set through `RuntimeOptions.assets`.

## Responsibility boundary

- `@jolly-pixel/asset` owns IDs, catalogs, references, handles, stores, and batches.
- `@jolly-pixel/engine` owns scene requests and reads prepared handles synchronously.
- `@jolly-pixel/runtime` performs browser asset I/O and reports progress to the engine.

See the [`@jolly-pixel/asset` README](../../asset/README.md) for the catalog
format and lower-level APIs.
