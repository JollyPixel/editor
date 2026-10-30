# Actor

An `Actor` is a named node of the scene tree with a
[Transform](actor-transform.md). It has no rendering or logic of its own:
[components](actor-component.md) add them. It extends
[ActorTree](actor-tree.md), so it holds child actors, which move with it.

## Creating an actor

```ts
import { Actor } from "@jolly-pixel/engine";

const player = new Actor(world, { name: "Player" });
```

Each actor gets a numeric `id`, counted from 0 in each world, and a random
16-character hex `persistentId`. `toString()` returns
`"$name:$id-$persistentId"`.

```ts
console.log(`${player}`);
// "Player:0-a1b2c3d4e5f60708"
```

Pass `persistentId` to restore a known id, such as one from a saved scene.
The constructor throws when another actor of the world holds it.
`world.sceneManager.actors.find(persistentId)` looks an actor up by its id.

The constructor accepts an `ActorOptions` object:

```ts
interface ActorOptions {
  /** Display name used for tree lookups, kept in `object3D.name`. */
  name: string;
  /** Parent actor; `null` adds to the scene root. @default null */
  parent?: Actor | null;
  /** Initial visibility of the Three.js group. @default true */
  visible?: boolean;
  /** Rendering layer(s) to enable. */
  layer?: number | number[];
  /** Restored persistent id. @default a new random id */
  persistentId?: string;
  /** Survives scene changes, see below. @default false */
  persistent?: boolean;
}
```

Without a `parent`, the actor is added at the root of the scene.

```ts
const hand = new Actor(world, {
  name: "RightHand",
  parent: player
});

// Nested actors can be found by path through ActorTree
const found = world.sceneManager.tree.getActor("Player/RightHand");
```

## Adding components

`addComponent` returns the actor for chaining; `addComponentAndGet` returns
the component. See [ActorComponent](actor-component.md) for the lifecycle.

```ts
import { ModelRenderer } from "@jolly-pixel/engine";

const player = new Actor(world, { name: "Player" })
  .addComponent(ModelRenderer, { asset: KnightModel })
  .addComponent(PlayerBehavior);
```

```ts
const camera = actor.addComponentAndGet(Camera3DControls, {
  fov: 75
});
```

## Retrieving components

Use `getComponent` to look up a component by class or by type name.
Use `getComponents` to iterate over all matching instances:

```ts
const behavior = actor.getComponent(PlayerBehavior);

for (const enemyScript of actor.getComponents(EnemyBehavior)) {
  enemyScript.reset();
}
```

Iterating `actor.components` yields the components not pending destruction,
in the order they were added. `has(component)` checks membership, and
`updating` is `true` while one of them receives `update()` calls.

```ts
for (const component of actor.components) {
  console.log(component.typeName);
}
```

`hasComponent` takes the same class or type name and returns a
boolean. `ensureComponent` returns the component of that class when
the actor has one, and adds it with the given options otherwise:

```ts
const isCamera = actor.hasComponent("Camera");
const health = actor.ensureComponent(HealthBehavior);
```

`findComponentInChildren` searches the actor's descendants depth-first
and `findComponentInParent` walks up its ancestors, nearest first.
Neither looks at the actor itself or at an actor pending destruction.
Both return `null` when nothing matches.

```ts
const weapon = player.findComponentInChildren(WeaponBehavior);
const vehicle = seat.findComponentInParent(VehicleBehavior);
```

## Removing components

`removeComponent` takes a component instance or a class, and destroys the
component at the end of the frame; lookups stop finding it at once. It
returns `false` when there was nothing to remove.

```ts
actor.removeComponent(ShieldBehavior);
```

## Managing Three.js children

`addChildren` and `removeChildren` attach and detach Three.js objects to the
actor's `object3D`. Removing a child disposes its GPU resources.

```ts
actor.addChildren(new THREE.Mesh(geometry, material));
actor.removeChildren(mesh);
```

On destruction, the actor disposes its remaining Three.js children. It stops
at nested actors and leaves textures alone, since they are often shared.

## Scene tree hierarchy

[ActorTree](actor-tree.md) lookups and walks work from any actor:

```ts
for (const child of player.getRootActors()) {
  console.log(child.name);
}
```

`root` returns the top-most ancestor, or the actor itself when it has
no parent. `hasDescendant(actor)` tells whether `actor` sits anywhere
below this one.

```ts
if (player.hasDescendant(pickedActor)) {
  select(pickedActor.root);
}
```

## Re-parenting

`setParent` keeps the actor's global position and orientation by default.

```ts
hand.setParent(otherActor);
```

Pass `keepLocal = true` to preserve the local values instead.

```ts
hand.setParent(otherActor, true);
```

## Active state

Setting `active` to `false` stops `update()` and `fixedUpdate()` for the
actor and its subtree. It keeps rendering: hide it with `object3D.visible`. `activeInHierarchy` is `true` only when the actor and
all its ancestors are active.

```ts
enemy.active = false;
enemy.object3D.visible = false;
```

A child keeps its own `active` value. Reactivating a parent does not
resume a child that was deactivated itself, and moving an actor under
an inactive parent pauses it.

## Persistent actors

A scene change, or removing an appended scene, destroys every actor except
root actors with `persistent: true` (option or property). They keep their
children, components and state. Destroy them yourself when no longer needed.

```ts
const player = world.createActor("Player", { persistent: true });
```

The flag only applies to root actors: a persistent child is destroyed
with its parent. When a [scene file](../systems/scene-file.md) holds an
actor whose id belongs to a live persistent actor, the live actor is
kept and the file's actor and its subtree are skipped.

## Destruction

`status` is `"alive"`, `"pending"` or `"destroyed"`.
`markDestructionPending()` marks the actor and its descendants pending: they
stop updating, cannot be used as a parent, and are destroyed at the end of
the frame.

```ts
player.markDestructionPending();

if (player.pendingForDestruction) {
  // …
}
```

`destroy()` destroys the actor at once, and only once.
`pendingForDestruction` is `true` while pending and once destroyed.

## See also

- [ActorComponent](actor-component.md) — the component base type
- [ActorTree](actor-tree.md) — tree traversal and lookups
- [Transform](actor-transform.md) — position, rotation, and scale
- [Behavior](../components/behavior.md) — scripting with
  decorators and properties
