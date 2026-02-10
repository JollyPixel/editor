## Actor

The `Actor` is the central **entity** in the engine's
Entity-Component architecture. On its own an actor is simply a
named node in the scene tree with a
[Transform](actor-transform.md) — it carries no rendering or
game logic. All capabilities are added through
[components](actor-component.md) and
[behaviors](../components/behavior.md).

Because `Actor` extends [ActorTree](actor-tree.md), every actor
is also a container for child actors, forming an arbitrarily deep
hierarchy (scene graph). Parent–child relationships drive
transform inheritance: moving a parent automatically moves all of
its descendants.

### Creating an actor

```ts
import { Actor } from "@jolly-pixel/engine";

const player = new Actor(gameInstance, { name: "Player" });
```

The constructor accepts an `ActorOptions` object:

```ts
interface ActorOptions {
  /** Display name used for tree lookups. */
  name: string;
  /** Parent actor; `null` adds to the scene root. @default null */
  parent?: Actor | null;
  /** Initial visibility of the Three.js group. @default true */
  visible?: boolean;
  /** Rendering layer(s) to enable. */
  layer?: number | number[];
}
```

When a `parent` is provided, the actor is automatically added as a
child of that parent in both the scene tree and the Three.js scene
graph. Otherwise it is added at the root of the scene.

```ts
const hand = new Actor(gameInstance, {
  name: "RightHand",
  parent: player
});

// Nested actors can be found by path through ActorTree
const found = gameInstance.scene.tree.getActor("Player/RightHand");
```

### Adding components

An actor gains its capabilities through components. Use
`registerComponent` for a fluent (chainable) API, or
`registerComponentAndGet` when you need a reference to the
component instance. See
[ActorComponent](actor-component.md) for the full component
lifecycle.

```ts
import { ModelRenderer } from "@jolly-pixel/engine";

const player = new Actor(gameInstance, { name: "Player" })
  .registerComponent(ModelRenderer, { path: "models/knight.glb" })
  .registerComponent(PlayerBehavior);
```

```ts
const camera = actor.registerComponentAndGet(Camera3DControls, {
  fov: 75
});
```

### Adding behaviors

[Behaviors](../components/behavior.md) are specialized components
that add scripting to an actor. They are registered with
`addBehavior` and can receive initial property values:

```ts
const behavior = player.addBehavior(PlayerBehavior, {
  speed: 0.1
});
```

Each behavior registers itself on the actor's `behaviors` map,
making it easy to query later:

```ts
const behavior = actor.getBehavior(PlayerBehavior);

for (const enemyScript of actor.getBehaviors(EnemyBehavior)) {
  enemyScript.reset();
}
```

### Transform

Every actor owns a [Transform](actor-transform.md) that wraps the
underlying Three.js object. It provides a clean API for reading
and writing position, orientation, and scale in both local and
global space.

```ts
actor.transform.setLocalPosition(new THREE.Vector3(0, 2, 0));
```

### Scene tree hierarchy

Because `Actor` extends [ActorTree](actor-tree.md), you can
traverse children, search by name or glob pattern, and walk the
subtree rooted at any actor.

```ts
for (const child of player.getRootActors()) {
  console.log(child.name);
}
```

### Re-parenting

An actor can be moved to a different parent at runtime with
`setParent`. By default the actor keeps its global (world) position and orientation.

```ts
hand.setParent(otherActor);
```

Pass `keepLocal = true` to preserve the local values instead.

```ts
hand.setParent(otherActor, true);
```

### Lifecycle

See [ActorComponent](./actor-component.md#lifecycle) lifecycle section.

### Destruction

Calling `markDestructionPending()` flags the actor (and
recursively all its descendants) for destruction. While flagged,
the actor stops updating and cannot be used as a parent. The
engine performs the actual cleanup on the next frame.

```ts
player.markDestructionPending();

if (player.isDestroyed()) {
  // …
}
```

### See also

- [ActorComponent](actor-component.md) — the component base type
- [ActorTree](actor-tree.md) — tree traversal and lookups
- [Transform](actor-transform.md) — position, rotation, and scale
- [Behavior](../components/behavior.md) — scripting with
  decorators and properties
