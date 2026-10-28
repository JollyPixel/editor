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

`loadScene()` requests a replacement and returns a `SceneLoad` immediately.
`SceneManager` loads the assets declared by `scene.assets` as one batch of the
world's `AssetCoordinator` and reports progress through that object. A scene
whose assets are all loaded, or that declares none, is `ready` before
`loadScene()` returns. Once the load is ready, `SceneManager` replaces the
current scene at the next frame boundary.

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

## Unloading the current scene

`unloadScene(scene)` tears `scene` down at once when it is the current scene:
appended scenes and `scene` are destroyed, then every actor, and append loads
that have not activated yet are cancelled. Afterwards `currentScene` is `null`.
A replacement load of `scene` that has not activated yet is cancelled. Any
other scene is left untouched, and a second call is a no-op.

The teardown is immediate rather than deferred to the next `beginFrame()`, so
a dispose path can release the scene's resources right after the call even
when no further frame runs. Call it outside a frame where possible. When it
runs during `update()` or `fixedUpdate()`, the rest of that frame skips the
torn-down actors and scenes.

```ts
sceneManager.unloadScene(editorScene);
```

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

  /** First non-pending actor with this name, or at this root-anchored path. */
  getActor(name: string): Actor<TContext> | null;
}

class ActorRegistry<TContext> {
  readonly tree: ActorTree<TContext>;

  has(actor: Actor<TContext>): boolean;
  /** `true` while an actor holds a component with `needUpdate`. */
  get updating(): boolean;
  /** Marks the component and destroys it at the end of the frame. */
  destroyLater(component: Component): void;
  /** Actors created while `build` runs. */
  collect(build: () => void): ReadonlySet<Actor<TContext>>;
  /** Destroys each actor whose parent is not in the set. */
  destroyRoots(actors: ReadonlySet<Actor<TContext>>): void;
}
```

## Frame lifecycle

`sceneManager.actors` owns the actors and components of every scene: it
attaches each new actor to the tree, queues each new component for `start()`,
and keeps the list of actors updated each frame. `Actor` and `ActorComponent`
register themselves; call it directly only for `destroyLater()`, or to collect
and tear down a group of actors.

`beginFrame()` activates ready scene loads, starts pending scenes, awakes
every actor created since the last frame, then starts pending components.
`fixedUpdate()` and `update()` only visit actors holding a component with
`needUpdate`, in creation order, so static actors cost nothing per frame.
An actor that gains its first updating component during a frame joins on
the next one; within an actor, a pass runs the components it started with.
`endFrame()` destroys the components passed to `destroyLater()`, then
every actor marked for destruction. Destroying an actor destroys its
children first, so each actor is destroyed once.
