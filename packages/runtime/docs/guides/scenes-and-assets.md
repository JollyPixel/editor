# Scenes and assets

Runtime connects the engine's scene manager to the asset coordinator. A scene's
declared assets are prepared before the scene becomes active.

## Configure the catalog

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

Resolve the catalog relative to the document so the same application code can
run under the web and desktop platform guides:

```ts
const runtime = await Runtime.create("canvas", {
  assets: {
    catalog: new URL("assets.json", document.baseURI)
  }
});
```

The asset package's [game developer guide](../../../asset/docs/guides/using-assets-in-a-game.md)
shows how to create typed references and declare `scene.assets`.

## Load the initial scene

Pass the scene to `runtime.load()`. Its assets are prepared before the runtime
starts:

```ts
await runtime.load({
  scene: new GameScene()
});
```

Additional references can share the same startup boundary:

```ts
await runtime.load({
  assets: [sharedUiReference],
  scene: new GameScene()
});
```

Additional assets load before the scene. See the
[`Runtime.load()` reference](../api/Runtime.md#loading-and-startup) for the full
startup order.

## Change scenes

Gameplay code requests later scenes from `SceneManager`:

```ts
const load = runtime.world.sceneManager.loadScene(
  new BattleScene(),
  {
    activation: "manual"
  }
);
```

The runtime prepares `scene.assets` in the background and updates the returned
`SceneLoad`. Call `load.allowActivation()` when a manually controlled load may
replace the active scene. Activation occurs at a frame boundary.

The engine's [SceneManager documentation](../../../engine/docs/systems/scene-manager.md)
defines the load states, progress events, cancellation, and activation gates.

## Start an explicit batch

Code outside a scene transition can load a fixed set of references through the
world's coordinator:

```ts
const batch = runtime.world.assetCoordinator.loadBatch(
  [iconReference],
  {
    onProgress(progress) {
      console.log(progress.completed, progress.total);
    }
  }
);

await batch.done;
```

Each batch owns its totals, failures, status, and completion promise. The asset
package's [`AssetLoadBatch` reference](../../../asset/docs/api/runtime/AssetLoadBatch.md)
describes retries and overlapping batches.
