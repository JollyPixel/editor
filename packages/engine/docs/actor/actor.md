# Actor

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

## Creating an actor

```ts
import { Actor } from "@jolly-pixel/engine";

const player = new Actor(world, { name: "Player" });
```

Each actor is assigned a numeric `id`, counted from 0 in each world,
and a random hex `persistentId` (16 characters) no other actor of the
world holds.
The `toString()` method returns `"$name:$id-$persistentId"`.

```ts
console.log(`${player}`);
// "Player:0-a1b2c3d4e5f60708"
```

Pass `persistentId` to give the actor a known id instead, for example
the id an actor had in a saved scene. Scene files do this for every
actor they build. The id must not belong to another actor of the
world: the constructor throws when it does. Look an actor up by its
id with `world.sceneManager.actors.find(persistentId)`, which returns
`null` once no actor holds it.

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

When a `parent` is provided, the actor is automatically added as a
child of that parent in both the scene tree and the Three.js scene
graph. Otherwise it is added at the root of the scene.

```ts
const hand = new Actor(world, {
  name: "RightHand",
  parent: player
});

// Nested actors can be found by path through ActorTree
const found = world.sceneManager.tree.getActor("Player/RightHand");
```

## Adding components

An actor gains its capabilities through components. Use
`addComponent` for a fluent (chainable) API, or
`addComponentAndGet` when you need a reference to the
component instance. See
[ActorComponent](actor-component.md) for the full component
lifecycle.

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

`actor.components` is the actor's `ActorComponents` collection.
Iterating it yields the components not pending destruction, in the
order they were added. `has(component)` checks membership, and
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

`removeComponent` takes a component instance or a class, and destroys
the component at the end of the frame. Until then the component no
longer shows up in `getComponent` or `hasComponent`. It returns
`false` when there was nothing to remove, including a component
already being removed.

```ts
actor.removeComponent(ShieldBehavior);
```

## Managing Three.js children

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

When removing children, their GPU resources are automatically
disposed

```ts
actor.removeChildren(mesh);
```

On destruction, the actor disposes the resources of all its remaining
Three.js children before clearing the group. The traversal stops on
nested actors, which own their own destruction, and leaves textures
untouched since they are commonly shared.

## Transform

Every actor owns a [Transform](actor-transform.md) that wraps the
underlying Three.js object. It provides a clean API for reading
and writing position, orientation, and scale in both local and
global space.

```ts
actor.transform.setLocalPosition(new THREE.Vector3(0, 2, 0));
```

## Scene tree hierarchy

Because `Actor` extends [ActorTree](actor-tree.md), you can
traverse children, search by name or glob pattern, and walk the
subtree rooted at any actor.

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

An actor can be moved to a different parent at runtime with
`setParent`. By default the actor keeps its global (world) position and orientation.

```ts
hand.setParent(otherActor);
```

Pass `keepLocal = true` to preserve the local values instead.

```ts
hand.setParent(otherActor, true);
```

## Lifecycle

See [ActorComponent](./actor-component.md#lifecycle) lifecycle section.

## Active state

Setting `active` to `false` stops `update()` and `fixedUpdate()` for
the actor and every actor below it. The actor stays in the tree and
keeps rendering: hide it with `object3D.visible` when it should
disappear too. `activeInHierarchy` is `true` only when the actor and
all its ancestors are active.

```ts
enemy.active = false;
enemy.object3D.visible = false;
```

A child keeps its own `active` value. Reactivating a parent does not
resume a child that was deactivated itself, and moving an actor under
an inactive parent pauses it.

## Persistent actors

A scene change destroys every actor, except root actors created with
`persistent: true` or flagged later through the `persistent` property.
They keep their children, components and state, and stay in the tree
of the next scene. Removing an appended scene keeps the persistent
roots it created as well. Destroy a persistent actor yourself when it
is no longer needed.

```ts
const player = world.createActor("Player", { persistent: true });
```

The flag only applies to root actors: a persistent child is destroyed
with its parent. When a [scene file](../systems/scene-file.md) holds an
actor whose id belongs to a live persistent actor, the live actor is
kept and the file's actor and its subtree are skipped.

## Destruction

`status` is `"alive"`, `"pending"` or `"destroyed"`. Calling
`markDestructionPending()` moves an alive actor (and recursively all
its descendants) to `"pending"`. While pending, the actor stops
updating and cannot be used as a parent. The engine destroys it at
the end of the frame.

```ts
player.markDestructionPending();

if (player.pendingForDestruction) {
  // …
}
```

`destroy()` destroys the actor at once and sets `status` to
`"destroyed"`. It runs once and later calls do nothing.
`pendingForDestruction` is `true` in both the pending and the
destroyed status.

## See also

- [ActorComponent](actor-component.md) — the component base type
- [ActorTree](actor-tree.md) — tree traversal and lookups
- [Transform](actor-transform.md) — position, rotation, and scale
- [Behavior](../components/behavior.md) — scripting with
  decorators and properties
