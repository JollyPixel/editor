# Scene graph

The engine core (`@jolly-pixel/engine/core`) never imports a renderer. It
keeps actors, components, scenes and transforms, and talks to a backend
through two ports: the [Renderer](renderer.md) and the `SceneGraph`. The root
entry (`@jolly-pixel/engine`) adds the three.js backend.

The core still uses three.js math classes (`Vector3`, `Quaternion`,
`Matrix4`, `Euler`, `Color`) for transforms and behavior properties.

## SceneGraph

A [SceneManager](scene-manager.md) is built on one graph. The graph makes a
node for every actor, and the engine pushes each change to it: hierarchy,
name, visibility, layers, the anchor socket and the local pose. The
[Transform](../actor/actor-transform.md) stays the source of truth: a pose
written on a node directly is overwritten by the next transform change.

```ts
interface ActorNode {
  attach(parent: ActorNode | null): void;
  seat(socket: Readonly<THREE.Matrix4> | null): void;
  rename(name: string): void;
  show(visible: boolean): void;
  enableLayer(layer: number): void;
  place(
    position: Readonly<THREE.Vector3>,
    quaternion: Readonly<THREE.Quaternion>,
    scale: Readonly<THREE.Vector3>
  ): void;
  dispose(): void;
}

interface SceneEnvironment {
  apply(file: SceneEnvironmentFile): void;
  dispose(): void;
}

interface SceneGraph {
  createNode(actor: Actor): ActorNode;
  createEnvironment(world: World): SceneEnvironment;
  /** `world.audio` when the world options pass none. */
  createAudio(): WorldAudio;
  /** Removes what the graph holds outside these surviving root nodes. */
  prune(survivors: Iterable<ActorNode>): void;
}
```

`attach(null)` puts the node at the root. `prune` runs when a scene is torn
down.

## Backend types

`actor.node`, `sceneManager.graph`, `world.audio` and the renderer's render
components are typed through the `SceneBackend` interface. The root entry
registers the three.js backend on it, so they are `ThreeActorNode`,
`ThreeSceneGraph`, `GlobalAudio` and `ThreeRenderComponent` without a cast.
A program that imports only `@jolly-pixel/engine/core` sees the interfaces
above. A program uses one backend: a world built on another graph keeps the
three.js types at compile time.

## ThreeSceneGraph

`new ThreeSceneGraph(scene?)` mirrors actors into a `THREE.Scene` (a new one
by default). Each actor gets a `THREE.Group` (`ThreeActorNode`) under its
parent's group; `enableLayer` also enables the layer on the scene. `prune`
removes every scene child that is not a surviving actor group, including
objects added to the scene by hand. `createEnvironment` returns a
`ThreeSceneEnvironment` (see [Scene environment](scene-file.md#scene-environment)),
and `createAudio` a new `GlobalAudio`.

A seated actor's group sits in a socket group under its parent's group, so
the actor's group always holds its local pose and a `TransformControls`
attached to it edits that pose.

```ts
import { findActor } from "@jolly-pixel/engine";

world.sceneManager.graph.scene.add(helper);
actor.node.object3D.add(mesh);

/** The actor owning `object`, or one of its ancestors; `null` otherwise. */
const picked = findActor(hit.object);
```

Move an actor through `actor.transform`, not through its group.

## HeadlessSceneGraph

`new HeadlessSceneGraph()` keeps no node: every call is a no-op, and
`createAudio` returns `{ volume: 1 }`. With a
[HeadlessRenderer](renderer.md#headlessrenderer), it runs a world, its
behaviors and its transforms without a GPU.

```ts
import { Systems } from "@jolly-pixel/engine/core";

const world = new Systems.World(new Systems.HeadlessRenderer(canvas), {
  sceneManager: new Systems.SceneManager(new Systems.HeadlessSceneGraph()),
  assetCoordinator
});
```
