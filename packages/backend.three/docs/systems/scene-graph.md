# ThreeSceneGraph

`ThreeSceneGraph` implements the `SceneGraph` port of `@jolly-pixel/ecs`: it
mirrors actors into a `THREE.Scene`.

Importing `@jolly-pixel/backend.three` registers the three.js types on the
ECS `SceneBackend` interface, so `actor.node`, `sceneManager.graph`,
`world.audio` and the renderer's render components are `ThreeActorNode`,
`ThreeSceneGraph`, `GlobalAudio` and `ThreeRenderComponent` without a cast.
A script that imports only `@jolly-pixel/ecs` gets the same types once the
backend is in its compiler `types`.

## new ThreeSceneGraph(scene?)

The graph renders into `scene`, a new `THREE.Scene` by default. Each actor
gets a `THREE.Group` (`ThreeActorNode`) under its parent's group;
`enableLayer` also enables the layer on the scene. `prune` removes every
scene child that is not a surviving actor group, including objects added to
the scene by hand. `createEnvironment` returns a
[`ThreeSceneEnvironment`](#threesceneenvironment), and `createAudio` a new
`GlobalAudio`. `postProcessing` (`null` by default) is the
[post-processing](renderer.md#post-processing) of every camera that has none
of its own; the scene environment sets it from the file's `glow`.

A seated actor's group sits in a socket group under its parent's group, so
the actor's group always holds its local pose and a `TransformControls`
attached to it edits that pose.

```ts
import { findActor } from "@jolly-pixel/backend.three";

world.sceneManager.graph.scene.add(helper);
actor.node.object3D.add(mesh);

/** The actor owning `object`, or one of its ancestors; `null` otherwise. */
const picked = findActor(hit.object);
```

Move an actor through `actor.transform`, not through its group.
`isVisibleInHierarchy(object)` is the walk of `transform.visibleInHierarchy`
over any `THREE.Object3D`.

## ThreeSceneEnvironment

Applies an ECS `EnvironmentFile` to the graph's scene.

```ts
class ThreeSceneEnvironment implements SceneEnvironment {
  readonly sun: THREE.DirectionalLight;
  readonly ambient: THREE.HemisphereLight;
  fallbackSky: THREE.Node | null;

  constructor(
    graph: ThreeSceneGraph,
    world: World,
    options?: { room?: BakedRoomEnvironment | null; }
  );

  apply(file: Readonly<EnvironmentFile>): void;
  copySunDirectionTo(target: THREE.Vector3): THREE.Vector3;
  aimSun(center?: THREE.Vector3Like, distance?: number): void;
  dispose(): void;
}
```

`graph.createEnvironment(world)` returns one without a loaded room map.

- The constructor adds `sun`, its target and `ambient` to the graph's scene, both at intensity 0. They stay in the scene for the environment's lifetime, so applying a file never adds or removes a light.
- `apply(file)` sets the sky, lights, fog, reflections, the renderer's tone mapping and exposure, and the graph's `postProcessing` for `glow`. It also stores the file in `graph.environment`.
- `fallbackSky` is the background node drawn while the applied sky is `none`, and `null` (the default) clears to the renderer's clear color. Setting it takes effect at once. Editors use it for a backdrop that follows their theme.
- The `day` and `night` skies read the sun direction through a uniform: moving the sun keeps the same sky node and shader.
- The `room` reflections use [BakedRoomEnvironment](baked-room-environment.md). Given `options.room`, the map is set during the first `apply`. Otherwise it loads in the background, is set once it arrives and the world is invalidated. A failed load logs a warning. Without a renderer `source`, no map is loaded.
- Changing the glow `strength` or `radius` keeps the same post-processing function, so camera pipelines are not rebuilt.
- `aimSun(center, distance)` places the sun `distance` units from `center` along the sun direction and aims it at `center`. Without arguments it reuses the last ones (the origin and 24 at first). Editors call it to follow the camera with sun shadows.
- `dispose()` removes the lights, clears the sky, fog, reflections, glow and `graph.environment`, and restores the renderer's tone mapping and exposure from before the constructor.
