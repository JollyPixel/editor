## Scene

The `Scene` is the top-level system that owns the
[actor tree](../actor/actor-tree.md), drives the
[component lifecycle](../actor/actor-component.md), and
orchestrates per-frame updates and destruction. It acts as the
bridge between the engine's Entity-Component model and the
underlying Three.js `THREE.Scene`.

Every [World](./world.md) holds exactly one `Scene`.
When the game connects, the scene **awakens** all actors. Each
animation frame follows a `beginFrame → fixedUpdate/update →
endFrame` lifecycle that snapshots the tree once and reuses it
for all updates within that frame.

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

The scene drives the lifecycle of all actors and components in
three phases — **awake**, **fixedUpdate**, and **update** —
called by the `World`:

```
world.connect()
  └─ scene.awake()                ← awakens all existing actors

Per animation frame:
  world.beginFrame()
  │ └─ scene.beginFrame()
  │      ├─ snapshot actors       ← walk tree once, cache all actors
  │      └─ start components      ← newly registered components
  │
  ├─ world.fixedUpdate(dt)        ← 0..N times at fixed rate (e.g. 60 Hz)
  │    └─ scene.fixedUpdate(dt)
  │         └─ fixedUpdate actors ← calls actor.fixedUpdate(dt) on each
  │
  ├─ world.update(dt)             ← once per frame
  │    └─ scene.update(dt)
  │         └─ update actors      ← calls actor.update(dt) on each
  │
  └─ world.endFrame()
       └─ scene.endFrame()
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

#### beginFrame

`beginFrame()` is called once per animation frame. It:

1. **Snapshots** the tree — walks all actors and caches them for
   the current frame. This snapshot is reused by all subsequent
   `fixedUpdate` and `update` calls within the same frame.
2. **Starts components** — any component queued in
   `componentsToBeStarted` whose actor is in the snapshot receives
   its `start()` call. Components whose actor is not yet in the
   snapshot are deferred to the next frame.

#### fixedUpdate

`fixedUpdate(deltaTime)` runs 0 to N times per frame at a constant
rate (driven by [FixedTimeStep](../internals/fixed-time-step.md)).
It calls `actor.fixedUpdate(deltaTime)` on each cached actor. Use
this for physics and deterministic logic.

#### update

`update(deltaTime)` runs once per frame. It calls
`actor.update(deltaTime)` on each cached actor. Use this for
rendering-related logic.

#### endFrame

`endFrame()` is called once at the end of the animation frame. It:

1. **Destroys components** — components queued in
   `componentsToBeDestroyed` have their `destroy()` hook called.
2. **Destroys actors** — actors flagged with
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
