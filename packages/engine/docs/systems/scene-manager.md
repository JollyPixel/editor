# SceneManager

`SceneManager` owns the active scene, appended scenes, scene-load state, and
frame-boundary activation. Gameplay code can request a scene synchronously from
an `ActorComponent` without accessing the runtime.

## Loading a scene

```ts
const load = this.actor.world.sceneManager.loadScene(
  new NextLevelScene()
);
```

`loadScene()` requests a replacement and returns a `SceneLoad` immediately. The
runtime loads the assets declared by `scene.assets` and reports progress through
that object. Once the load is ready, `SceneManager` replaces the current scene
at the next frame boundary.

```ts
load.status;
load.completed;
load.total;
load.currentAsset;
load.error;
```

The status is one of `requested`, `loading`, `ready`, `failed`, `cancelled`, or
`active`. Starting another replacement cancels an unfinished replacement.

## Holding activation for a transition

Use manual activation when a visual transition must finish before the scene is
replaced:

```ts
const load = sceneManager.loadScene(
  new NextLevelScene(),
  {
    activation: "manual"
  }
);

fade.start();
```

The fade and asset loading can advance independently during normal synchronous
updates:

```ts
if (fade.isOpaque) {
  load.allowActivation();
}
```

Calling `allowActivation()` before loading finishes records the permission and
waits for readiness. Calling it after loading finishes releases the ready scene
for activation. Both paths replace the scene at the next `beginFrame()`.

## Appending a scene

`appendScene()` uses the same loading and activation rules without replacing
the current scene:

```ts
const load = sceneManager.appendScene(
  new InventoryScene(),
  {
    activation: "manual"
  }
);
```

Different appended scenes load independently. Calling `removeScene()` before
one activates cancels its load. A replacement takes priority at a frame
boundary and cancels additive requests that have not activated yet.

## Observing loads

`SceneManager.sceneLoad` points to the latest replacement request. The manager
emits `sceneLoadRequested` and `sceneLoadChanged` for replacement and additive
loads, so loading UI can observe either operation:

```ts
sceneManager.on("sceneLoadChanged", (load) => {
  loadingBar.set(load.completed, load.total);
});
```

Components may keep the returned `SceneLoad` and read it directly instead.
Neither approach introduces promises into the ECS lifecycle.

## API

```ts
interface SceneLoadOptions {
  activation?: "automatic" | "manual";
}

interface SceneLoad<TContext> {
  readonly scene: Scene<TContext>;
  readonly status: SceneLoadStatus;
  readonly activationAllowed: boolean;
  readonly completed: number;
  readonly total: number;
  readonly currentAsset: AssetRecord | null;
  readonly error: Error | null;

  allowActivation(): void;
  cancel(): void;
}

class SceneManager<TContext> {
  readonly currentScene: Scene<TContext> | null;
  readonly sceneLoad: SceneLoad<TContext> | null;
  readonly hasPendingScene: boolean;

  loadScene(
    scene: Scene<TContext>,
    options?: SceneLoadOptions
  ): SceneLoad<TContext>;

  appendScene(
    scene: Scene<TContext>,
    options?: SceneLoadOptions
  ): SceneLoad<TContext>;
}
```
