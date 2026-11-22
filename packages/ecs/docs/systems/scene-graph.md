# Scene graph

`@jolly-pixel/ecs` never imports a renderer. It keeps actors, components,
scenes and transforms, and talks to a backend through two ports: the
[Renderer](renderer.md) and the `SceneGraph`. `@jolly-pixel/backend.three`
implements both with three.js.

## SceneGraph

A [SceneManager](scene-manager.md) is built on one graph. The graph makes a
node for every actor, and ECS pushes each change to it: hierarchy,
name, visibility, layers, the anchor socket and the local pose. The
[Transform](../actor/actor-transform.md) stays the source of truth: a pose
written on a node directly is overwritten by the next transform change.

```ts
interface ActorNode {
  attach(parent: ActorNode | null): void;
  seat(socket: Readonly<Mat4> | null): void;
  rename(name: string): void;
  show(visible: boolean): void;
  enableLayer(layer: number): void;
  place(
    position: Readonly<Vec3>, // [x, y, z]
    quaternion: Readonly<Quat>, // [x, y, z, w]
    scale: Readonly<Vec3>
  ): void;
  dispose(): void;
}

interface SceneEnvironment {
  apply(file: Readonly<EnvironmentFile>): void;
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
components are typed through the `SceneBackend` interface. A program that
imports no backend sees the interfaces above. A backend registers its types
by augmenting `SceneBackend`, which `@jolly-pixel/ecs` exports at the top
level for that purpose:

```ts
declare module "@jolly-pixel/ecs" {
  interface SceneBackend {
    node: MyActorNode;
    graph: MySceneGraph;
    audio: MyAudio;
    renderComponent: MyRenderComponent;
  }
}
```

The augmentation only merges into a top-level export, not into a member of
`Systems`. A program uses one backend: a world built on another graph keeps
the registered types at compile time.

## HeadlessSceneGraph

`new HeadlessSceneGraph()` keeps no node: every call is a no-op, and
`createAudio` returns `{ volume: 1 }`. With a
[HeadlessRenderer](renderer.md#headlessrenderer), it runs a world, its
behaviors and its transforms without a GPU.

```ts
import { Systems } from "@jolly-pixel/ecs";

const world = new Systems.World(new Systems.HeadlessRenderer(canvas), {
  sceneManager: new Systems.SceneManager(new Systems.HeadlessSceneGraph()),
  assetCoordinator
});
```
