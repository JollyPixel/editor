# Using assets in a game

`@jolly-pixel/runtime` constructs the loading infrastructure and registers the
engine's model, font, audio, and texture loaders. Game code works mainly with
asset references and scene dependencies.

## Add the asset to the catalog

Place `assets.json` in the Vite project's `public/` directory:

```json
{
  "version": 1,
  "assets": [
    {
      "id": "hero-model",
      "kind": "model",
      "source": "models/hero.glb"
    }
  ]
}
```

The ID remains stable when the source file changes. The `kind` must match the
asset type used by the reference.

## Create and use the reference

Use the shared engine token for the asset kind:

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

The scene manager waits for `scene.assets` before it activates the scene.
Components can therefore read prepared values synchronously during their ECS
lifecycle.

## Connect the catalog to the runtime

Pass the catalog URL when creating the runtime, then load the initial scene:

```ts
import {
  Runtime,
  loadRuntime
} from "@jolly-pixel/runtime";

const runtime = await Runtime.create("canvas", {
  assets: {
    catalog: "/assets.json"
  }
});

await loadRuntime(runtime, {
  scene: new GameScene()
});
```

`Runtime.create()` fetches and parses the manifest. `loadRuntime()` prepares the
initial scene's dependencies before starting the game loop.

## Load dynamic content

Code outside a scene transition can start an explicit batch:

```ts
const batch = runtime.world.assetCoordinator.loadBatch(
  [heroModel],
  {
    onProgress(progress) {
      console.log(progress.completed, progress.total);
    }
  }
);

await batch.done;
```

See [`AssetLoadBatch`](../api/runtime/AssetLoadBatch.md) for failure and retry
behavior.
