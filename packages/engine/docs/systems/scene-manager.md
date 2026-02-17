## Scene

The `Scene` is the top-level system that owns the
[actor tree](../actor/actor-tree.md), drives the
[component lifecycle](../actor/actor-component.md), and
orchestrates per-frame updates and destruction. It acts as the
bridge between the engine's Entity-Component model and the
underlying Three.js `THREE.Scene`.

Every [World](./world.md) holds exactly one `Scene`.
When the game connects, the scene **awakens** all actors; on every
frame the game instance calls `scene.update(deltaTime)`, which
starts newly registered components, updates every actor, and
cleans up anything marked for destruction.

### Creating a scene

```ts
import { SceneEngine } from "@jolly-pixel/engine";

// Default — creates its own THREE.Scene internally
const scene = new SceneEngine();

// Or wrap an existing Three.js scene
const threeScene = new THREE.Scene();
const scene = new SceneEngine(threeScene);
```

The underlying Three.js scene is accessible at any time through
`getSource()`:

```ts
const threeScene = scene.getSource();
threeScene.background = new THREE.Color(0x222222);
```

### Actor tree

The scene exposes a root [ActorTree](../actor/actor-tree.md) via
the `tree` property. When an [Actor](../actor/actor.md) is created
without a parent, it is automatically added to this tree. All tree
traversal and lookup features are available from the root:

```ts
const player = scene.tree.getActor("Player");
```

### Lifecycle

The scene drives the lifecycle of all actors and components in two
phases — **awake** and **update** — called by the
`World`:

```
world.connect()
  └─ scene.awake()           ← awakens all existing actors

world.update(dt)      ← called every frame
  └─ scene.update(dt)
       ├─ start components   ← newly registered components
       ├─ update actors      ← calls actor.update(dt) on each
       ├─ destroy components ← pending component destructions
       └─ destroy actors     ← pending actor destructions
```

#### Awake

When `awake()` is called (typically once, at connection time), the
scene walks the entire tree and calls `awake()` on every actor
that has not yet been awoken.

It then emits the `"awake"` event.

```ts
scene.on("awake", () => {
  console.log("Scene is ready");
});
```

#### Update loop

On each frame, `update(deltaTime)` performs the following steps in
order:

1. **Snapshot** — the tree is walked and all actors are cached for
   the current frame.
2. **Start components** — any component queued in
   `componentsToBeStarted` whose actor is part of the snapshot
   receives its `start()` call and is removed from the queue.
   Components whose actor is not yet in the snapshot are deferred
   to the next frame.
3. **Update actors** — each cached actor's `update(deltaTime)` is
   called, which in turn updates all of its components.
4. **Destroy components** — components queued in
   `componentsToBeDestroyed` have their `destroy()` hook called.
5. **Destroy actors** — actors flagged with
   `pendingForDestruction` are recursively destroyed (children
   first) and removed from both the tree and the Three.js scene
   graph.

### Destroying actors

Actors can be destroyed through the scene:

```ts
scene.destroyActor(player);
```

This recursively destroys all children first, then removes the
actor from the cached snapshot, the tree, and calls
`actor.destroy()`. For deferred destruction (cleaned up at the end
of the current frame), mark the actor as pending from the actor
itself:

```ts
player.markDestructionPending();
```

See [Actor — Destruction](../actor/actor.md#destruction) for more
details.

### Destroying components

Individual components can be removed without destroying their
actor:

```ts
scene.destroyComponent(component);
```

The component is flagged as `pendingForDestruction` and queued. If
it was still waiting for its `start()` call, it is removed from
the start queue. The actual `destroy()` hook runs at the end of
the current frame's update.

### Events

`SceneEngine` extends `EventEmitter` and emits:

| Event | When it fires |
| ----- | ------------- |
| `awake` | After all actors have been awoken during `scene.awake()` |

### See also

- [Actor](../actor/actor.md) — the engine's core entity
- [ActorComponent](../actor/actor-component.md) — component
  lifecycle and API
- [ActorTree](../actor/actor-tree.md) — tree traversal and lookups
