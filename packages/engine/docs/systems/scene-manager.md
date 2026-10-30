# SceneManager

`SceneManager` owns the current scene, the appended scenes and their loads,
and swaps scenes at frame boundaries. Any component can request a scene
synchronously.

## Loading a scene

```ts
const load = this.actor.world.sceneManager.loadScene(
  new NextLevelScene()
);
```

`loadScene()` returns a `SceneLoad` at once and loads `scene.assets` as one
batch of `world.assetCoordinator`. A scene with nothing left to load is
`ready` before `loadScene()` returns. A ready scene replaces the current one
at the next frame boundary.

```ts
load.status;
load.completed;
load.total;
load.currentAsset;
load.error;

await load.done;
```

The status is one of `requested`, `loading`, `ready`, `failed`, `cancelled`, or
`active`. Starting another replacement cancels an unfinished replacement.

`done` resolves when the load becomes `ready`. It rejects with `error` when the
load fails, for example with `AssetNotFoundError` for an asset missing from the
catalog or `AssetBatchLoadError` when a loader fails, and with an `Error` when
the load is cancelled. An unobserved rejection is not reported as unhandled.

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

```ts
if (fade.isOpaque) {
  load.allowActivation();
}
```

`allowActivation()` may come before or after loading finishes. The scene is
replaced at the next `beginFrame()` once both are done.

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

## Unloading the current scene

`unloadScene(scene)` tears `scene` down at once when it is the current scene:
appended scenes and `scene` are destroyed, then every actor. Pending appends
and a pending replacement by `scene` are cancelled, and `currentScene`
becomes `null`. Any other scene is left untouched.

Prefer calling it outside a frame. During `update()` or `fixedUpdate()`, the
rest of that frame skips the torn-down actors.

```ts
sceneManager.unloadScene(editorScene);
```

## Observing loads

`sceneLoad` is the latest replacement request. `sceneLoadRequested` and
`sceneLoadChanged` fire for replacements and appends:

```ts
sceneManager.on("sceneLoadChanged", (load) => {
  loadingBar.set(load.completed, load.total);
});
```

Components may also poll the returned `SceneLoad`.

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
  readonly done: Promise<void>;

  allowActivation(): void;
  cancel(): void;
}

class SceneManager<TContext> {
  readonly actors: ActorRegistry<TContext>;
  readonly tree: ActorTree<TContext>;
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

  unloadScene(scene: Scene<TContext>): void;
  /** Removes an appended scene, by instance or name. */
  removeScene(scene: Scene<TContext> | string): void;

  /** First non-pending actor with this name, or at this root-anchored path. */
  getActor(name: string): Actor<TContext> | null;
}

class ActorRegistry<TContext> {
  readonly tree: ActorTree<TContext>;

  has(actor: Actor<TContext>): boolean;
  /** The actor holding this persistent id, pending destruction or not. */
  find(persistentId: string): Actor<TContext> | null;
  /** `true` while an actor holds a component with `needUpdate`. */
  get updating(): boolean;
}
```

Replacing, unloading or removing a scene destroys its actors except
[persistent roots](../actor/actor.md#persistent-actors).

## Frame lifecycle

`beginFrame()` activates ready scene loads, starts pending scenes, awakes
every actor created since the last frame, then starts pending components.
`fixedUpdate()` and `update()` only visit active actors holding a component
with `needUpdate`, in creation order, so static actors cost nothing per frame.
An actor that gains its first updating component during a frame joins on
the next one; within an actor, a pass runs the components it started with.
`endFrame()` destroys the components passed to `destroyLater()`, then
every actor marked for destruction. Destroying an actor destroys its
children first, so each actor is destroyed once.
