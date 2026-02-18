# Scene & SceneManager Extension — Implementation Plan

> Branch: `minimal-scene-implementation`
> Packages affected: `packages/engine`

---

## 1. Context & Motivation

The current `SceneManager` owns a flat actor registry and a single `THREE.Scene`. There is no concept of a discrete, named **Scene** that can be swapped in/out at runtime. This plan introduces:

- A **`Scene`** class — a self-contained lifecycle object that populates and owns a set of actors.
- Two new **`SceneManager`** methods: `setScene` (immediate swap) and `loadScene` (deferred to next frame).

The design stays minimal: `Scene` mirrors the existing `ActorComponent` lifecycle (`awake → start → update → fixedUpdate → destroy`) so it feels native to the engine.

---

## 2. File Structure

```
packages/engine/src/
  systems/
    Scene.ts              ← NEW  (Scene base class)
    SceneManager.ts       ← MODIFIED
    index.ts              ← MODIFIED (re-export Scene)
```

No new packages, no new dependencies.

---

## 3. `Scene` Class Design

### 3.1 Location

`packages/engine/src/systems/Scene.ts`

### 3.2 Interface / Abstract Base

```ts
// Import Third-party Dependencies
import { EventEmitter } from "@posva/event-emitter";

// Import Internal Dependencies
import type { World, WorldDefaultContext } from "./World.ts";

export type SceneLifecycleEvents = {
  awake: [];
  start: [];
  destroy: [];
};

export abstract class Scene<
  TContext = WorldDefaultContext
> extends EventEmitter<SceneLifecycleEvents> {
  readonly name: string;

  /** Set by SceneManager when the scene is activated. */
  world!: World<any, TContext>;

  constructor(name: string) {
    super();
    this.name = name;
  }

  /**
   * Called once when the scene is first activated (before the first start/update).
   * Populate actors here.
   */
  awake(): void {}

  /**
   * Called once at the beginning of the first frame after awake.
   * Useful for cross-actor initialization that requires all awake() calls to have run.
   */
  start(): void {}

  /**
   * Called every frame (variable rate).
   */
  update(_deltaTime: number): void {}

  /**
   * Called every fixed step (deterministic rate).
   */
  fixedUpdate(_deltaTime: number): void {}

  /**
   * Called when the scene is being replaced or explicitly unloaded.
   * Clean up timers, subscriptions, etc. Actor destruction is handled
   * automatically by SceneManager.
   */
  destroy(): void {}
}
```

### 3.3 Key Design Decisions

| Decision | Rationale |
|---|---|
| `abstract class` not `interface` | Provides default no-op implementations so subclasses only override what they need |
| `world` injected by `SceneManager` | Avoids circular constructor args; mirrors how `ActorComponent` gets `actor` |
| Extends `EventEmitter` | Consistent with `World` and `SceneManager`; allows external listeners on lifecycle events |
| No built-in `ActorTree` on Scene | Actors are still owned by `SceneManager.tree`; the Scene _populates_ the tree via `this.world.createActor(...)` |
| `start()` is separate from `awake()` | Matches the existing component lifecycle; `awake` = setup actors, `start` = cross-actor wiring |

### 3.4 Concrete Usage Example

```ts
class GameplayScene extends Scene {
  awake() {
    this.world.createActor("Player").addComponent(PlayerBehavior);
    this.world.createActor("Environment").addComponent(EnvironmentLoader);
  }

  start() {
    // All actors are awoken; safe to cross-reference
    const player = this.world.sceneManager.getActor("Player");
    // ...
  }

  destroy() {
    // cancel any top-level subscriptions created in this scene
  }
}
```

---

## 4. `SceneManager` Changes

### 4.1 New State

```ts
#currentScene: Scene<TContext> | null = null;
#pendingScene: Scene<TContext> | null = null;
#sceneStartPending = false;   // true after awake, before first start
```

### 4.2 `setScene(scene)` — Immediate

```ts
setScene(scene: Scene<TContext>): void
```

**Behaviour (synchronous, called any time):**

1. If there is a `#currentScene`:
   a. Call `#currentScene.destroy()` — scene-level cleanup hook.
   b. Destroy all registered actors (`sceneManager.tree.destroyAllActors()` + flush `endFrame` destruction immediately).
   c. Clear `componentsToBeStarted` and `componentsToBeDestroyed`.
   d. Reset `THREE.Scene` (clear children, optionally swap to a new `THREE.Scene` owned by the incoming scene — see §4.5).
2. Inject `world` reference into the incoming scene.
3. Call `scene.awake()` — this populates actors; each actor constructor calls `registerActor`.
4. Run `SceneManager.awake()` (the existing method that wakes all tree actors).
5. Set `#currentScene = scene`.
6. Set `#sceneStartPending = true` so `beginFrame` triggers `start()` on the next tick.
7. Emit `"sceneChanged"` event.

### 4.3 `loadScene(scene)` — Deferred

```ts
loadScene(scene: Scene<TContext>): void
```

**Behaviour:**

1. Store `scene` in `#pendingScene`.
2. The actual transition happens at the top of the **next** `beginFrame()` call (before component starts and before update).
3. Inside `beginFrame()`, if `#pendingScene !== null`:
   - Call `setScene(#pendingScene)` (reuse the immediate logic).
   - Clear `#pendingScene = null`.

This guarantees the swap never happens mid-frame.

### 4.4 Updated `beginFrame()`

```ts
beginFrame() {
  // Flush deferred scene load FIRST
  if (this.#pendingScene !== null) {
    this.setScene(this.#pendingScene);
    this.#pendingScene = null;
  }

  // Flush pending scene start (first frame after awake)
  if (this.#sceneStartPending) {
    this.#currentScene?.start();
    this.#sceneStartPending = false;
  }

  // existing logic ...
  this.#cachedActors = Array.from(this.#registeredActors);
  // ... component starts ...
}
```

### 4.5 `THREE.Scene` Ownership (optional / minimal variant)

For the **minimal** implementation, keep the single `SceneManager.default` `THREE.Scene` and simply clear it on scene swap (call `default.clear()`). This avoids introducing a per-Scene THREE.Scene for now.

A future extension can let `Scene` declare its own `THREE.Scene` background/fog/env and have `SceneManager` swap it on activation.

### 4.6 New Events on `SceneManager`

Extend `SceneEvents`:

```ts
export type SceneEvents = {
  awake: [];
  sceneChanged: [scene: Scene<any>];    // after setScene completes
  sceneDestroyed: [scene: Scene<any>];  // before old scene is torn down
};
```

### 4.7 New Accessors

```ts
get currentScene(): Scene<TContext> | null {
  return this.#currentScene;
}

get hasPendingScene(): boolean {
  return this.#pendingScene !== null;
}
```

---

## 5. Scene `update` / `fixedUpdate` Wiring

The `Scene` lifecycle hooks (`update`, `fixedUpdate`) are called by `SceneManager` after actors are updated. This lets the scene-level script react to the frame after all actors have ticked.

Update `SceneManager.update()`:

```ts
update(deltaTime: number) {
  this.#cachedActors.forEach((actor) => actor.update(deltaTime));
  this.#currentScene?.update(deltaTime);
}

fixedUpdate(deltaTime: number) {
  this.#cachedActors.forEach((actor) => actor.fixedUpdate(deltaTime));
  this.#currentScene?.fixedUpdate(deltaTime);
}
```

---

## 6. Actor Destruction on Scene Swap

When `setScene` is called, all current actors must be torn down cleanly. The proposed sequence:

```
currentScene.destroy()
  → tree.destroyAllActors()        (marks all actors pendingForDestruction)
  → flush: iterate #registeredActors and call destroyActor() on each
  → clear componentsToBeStarted[]
  → clear componentsToBeDestroyed[]
  → default.clear()                (removes THREE objects from scene graph)
  → #registeredActors.clear()
  → #actorsByName.clear()
  → tree.children = []
```

This is effectively an inlined synchronous `endFrame` for destruction only, so we don't need to wait a full tick.

---

## 7. Export Updates

**`packages/engine/src/systems/index.ts`** — add:
```ts
export * from "./Scene.ts";
```

**`packages/engine/src/index.ts`** — already re-exports `Systems`, so `Scene` is automatically public.

---

## 8. Implementation Steps (ordered)

1. **Create `Scene.ts`** with the abstract base class and `SceneLifecycleEvents`.
2. **Extend `SceneEvents`** in `SceneManager.ts` with `sceneChanged` and `sceneDestroyed`.
3. **Add private state** (`#currentScene`, `#pendingScene`, `#sceneStartPending`) to `SceneManager`.
4. **Implement `setScene()`** with the full teardown + awake sequence.
5. **Implement `loadScene()`** as a one-liner that stores `#pendingScene`.
6. **Update `beginFrame()`** to check and flush `#pendingScene` and `#sceneStartPending`.
7. **Update `update()` / `fixedUpdate()`** to call `#currentScene?.update/fixedUpdate`.
8. **Add accessors** (`currentScene`, `hasPendingScene`).
9. **Update `systems/index.ts`** to export `Scene`.
10. **Write tests** in `packages/engine/test/Scene.spec.ts`:
    - `setScene` wires `world`, calls `awake`, emits `sceneChanged`.
    - `loadScene` does NOT swap immediately; swap happens on next `beginFrame`.
    - `setScene` from a running scene destroys all old actors cleanly.
    - `scene.update` and `scene.fixedUpdate` are called each frame after actor updates.
    - `scene.start` is called once on the frame after `awake`, not immediately.

---

## 9. Out of Scope (future work)

- **Scene stack** (`pushScene` / `popScene`) — additive scenes layered on top of each other.
- **Async loading** — `loadSceneAsync(factory)` that awaits asset loading before swapping.
- **Scene-owned `THREE.Scene`** — per-scene background color, fog, environment maps.
- **Transition effects** — fade-in/fade-out between scenes.
- **Additive loading** — loading a scene without unloading the current one.
- **Scene serialization** — save/restore scene state.
