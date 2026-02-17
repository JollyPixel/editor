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

const player = new Actor(world, { name: "Player" });
```

Each actor is assigned a sequential numeric `id` and a persistent
random hex `persistentId` (16 characters) at construction.
The `toString()` method returns `"$name:$id-$persistentId"`.

```ts
console.log(`${player}`);
// "Player:0-a1b2c3d4e5f60708"
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
const hand = new Actor(world, {
  name: "RightHand",
  parent: player
});

// Nested actors can be found by path through ActorTree
const found = world.scene.tree.getActor("Player/RightHand");
```

### Adding components

An actor gains its capabilities through components. Use
`addComponent` for a fluent (chainable) API, or
`addComponentAndGet` when you need a reference to the
component instance. See
[ActorComponent](actor-component.md) for the full component
lifecycle.

```ts
import { ModelRenderer } from "@jolly-pixel/engine";

const player = new Actor(world, { name: "Player" })
  .addComponent(ModelRenderer, { path: "models/knight.glb" })
  .addComponent(PlayerBehavior);
```

```ts
const camera = actor.addComponentAndGet(Camera3DControls, {
  fov: 75
});
```

### Retrieving components

Use `getComponent` to look up a component by class or by type name.
Use `getComponents` to iterate over all matching instances:

```ts
const behavior = actor.getComponent(PlayerBehavior);

for (const enemyScript of actor.getComponents(EnemyBehavior)) {
  enemyScript.reset();
}
```

### Managing Three.js children

Use `addChildren` and `removeChildren` to attach or detach
Three.js objects (meshes, lights, helpers, etc.) to the actor's
underlying `object3D` group. This avoids manipulating `object3D`
directly and ensures GPU resources are properly disposed.

```ts
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const mesh = new THREE.Mesh(geometry, material);

actor.addChildren(mesh);
```

When removing children, their geometry and materials are
automatically disposed:

```ts
actor.removeChildren(mesh);
```

On destruction, the actor traverses all remaining Three.js children
and disposes their GPU resources (geometry and materials) before
clearing the group.

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
