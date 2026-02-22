# README.md

<h1 align="center">
  engine
</h1>

<p align="center">
  JollyPixel Three.js engine
</p>

## 📌 About

Minimal and opinionated [ECS][ecs] built on top of Three.js inspired by [Superpowers][superpowers] and [Craftstudio][craftstudio].

> [!WARNING]
> The engine is still in a heavy phase of development (expect frequent API breaking changes).

## 💡 Features

- [ECS][ecs] architecture with Actors, Components, and Scenes
- Godot-like [Signals][signals]
- Behavior scripts
- Input controls (mouse, keyboard, gamepads, touchpad)
- Built-in renderers (3D models, 3D text, sprites, …)
- Asset management
- Audio (background music, sound library, spatial audio)
- UI toolkits for minimal in-game interfaces

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/engine
# or
$ yarn add @jolly-pixel/engine
```

## 🔎 Guides (WIP 🚧)

- [Hello World with JollyPixel Engine](./docs/guides/hello-world.md)

## 📚 API

### ⚙️ Systems

> [!TIP]
> [@jolly-pixel/runtime](../runtime/README.md) manage most of that for you

Systems are responsible for driving the game loop, orchestrating rendering, and managing shared
resources such as assets. They operate on actors and their components
each frame.

- [World](./docs/systems/world.md) — top-level orchestrator that ties the renderer, scene,
  input, and audio into a unified game loop.
  - [Renderer](./docs/systems/renderer.md) — abstracts the Three.js render pipeline and supports
    direct and post-processing render strategies.
  - [SceneManager](./docs/systems/scene-manager.md) — the ECS world manager that owns the actor tree and drives
    per-frame lifecycle (awake → start → update → destroy).
- [Asset](./docs/asset.md) — lazy-loading asset pipeline with a
  registry of loaders, a queue, and a cache.

<details>
<summary>Code Example</summary>

```ts
import { Systems, Actor } from "@jolly-pixel/engine";

const sceneManager = new Systems.SceneManager();
const renderer = new Systems.ThreeRenderer(canvas, {
  sceneManager,
  renderMode: "direct"
});
const game = new Systems.World(renderer, {
  enableOnExit: true,
  sceneManager
});

game.connect();
```

</details>

### 🎭 Actor

An Actor is a named node in the scene tree that holds a Transform, a list of Components, and a
dictionary of Behaviors. The engine uses the name *Actor* (inspired by [Superpowers][superpowers]) instead of the traditional *Entity* term.

- [Actor](./docs/actor/actor.md) — the entity itself, holding its
  transform, components, and behaviors.
  - [Transform](./docs/actor/actor-transform.md) — built-in component
    wrapping a Three.js Object3D and exposing a complete local/global
    transform API (position, orientation, scale, movement).
  - [ActorTree](./docs/actor/actor-tree.md) — tree structure that
  manages parent-child actor relationships and provides pattern-based
  lookups.

<details>
<summary>Code Example</summary>

```ts
const player = world.createActor("Player");
player.transform.setLocalPosition({ x: 0, y: 1, z: 0 });

const child = world.createActor("Weapon", {
  parent: player
});

player.destroy();
```

</details>

#### 🧩 Components

Components are pure data and logic units attached to an Actor. They come in three flavours:

- [ActorComponent](./docs/actor/actor-component.md) — the base class all components extend (behaviors and renderers are ActorComponent).
  - [Signals](./docs/components/signal.md) — lightweight pub/sub event emitter for actor-level communication (Godot-inspired signals).
- [Renderers](./docs/components/renderers.md) — visual components (sprites, models, text, tiled maps) that know how to draw themselves.
  - [Camera Controls](./docs/components/camera-3d-controls.md)
- [Behavior](./docs/components/behavior.md) — script components with a property system and decorator-driven initialization.

<details>
<summary>Code Example</summary>

```ts
import { Behavior, Actor, SignalEvent } from "@jolly-pixel/engine";

export interface PlayerBehaviorOptions {
  speed?: number;
}

class PlayerBehavior extends Behavior {
  onMovement = new SignalEvent();
  speed = 0.1;

  constructor(
    actor: Actor, options: PlayerBehaviorOptions = {}
  ) {
    super(actor);
    this.speed = options?.speed ?? 0.1;
  }

  update() {
    if (this.actor.world.input.isKeyDown("ArrowUp")) {
      this.onMovement.emit();
      this.actor.transform.moveForward(this.speed);
    }
  }
}

new Actor(world, { name: "player" })
  .addComponent(ModelRenderer, { path: "models/Player.glb" })
  .addComponent(PlayerBehavior, { speed: 0.5 });
```

</details>

### 🎮 Device Controls

Aggregates all physical devices (mouse, keyboard, gamepads, touchpad, screen) behind a unified
query API so that behaviors can react to player actions without coupling to a specific device.

- [Input](./docs/controls/input.md) — central input manager
  - [Mouse](./docs/controls/mouse.md)
  - [Keyboard](./docs/controls/keyboard.md)
  - [Gamepad](./docs/controls/gamepad.md)
  - [Touchpad](./docs/controls/touchpad.md)
  - [Screen](./docs/controls/screen.md)
- [CombinedInput](./docs/controls/combinedinput.md) — composable input conditions (AND, OR, NOT, sequence) for complex key bindings.

<details>
<summary>Code Example</summary>

```ts
import { InputCombination } from "@jolly-pixel/engine";

const { input } = world;

if (input.isKeyDown("Space")) {
  console.log("jump!");
}

const dashCombo = InputCombination.all(
  InputCombination.key("ShiftLeft"),
  InputCombination.key("ArrowRight")
);
if (dashCombo.evaluate(input)) {
  console.log("dash!");
}
```

> [!TIP]
> In ActorComponent or Behavior input are accessible through this.actor.world.input

</details>

### 🔊 Audio

Manages sound playback across the engine. It provides a global volume controller, a factory for creating audio sources, and a playlist-based background music manager.

- [Audio](./docs/audio/audio.md) — global audio controller owning the
  AudioContext and master volume.
  - [AudioLibrary](./docs/audio/audio-library.md)
  - [AudioBackground](./docs/audio/audio-background.md) —
    playlist-based background music with sequential track playback,
    pause/resume/stop, and playlist chaining.

<details>
<summary>Code Example</summary>

```ts
import { GlobalAudioManager, AudioBackground } from "@jolly-pixel/engine";

const audioManager = GlobalAudioManager.fromWorld(world);
const bg = new AudioBackground({
  audioManager,
  autoPlay: true,
  playlists: [{
    name: "main",
    onEnd: "loop",
    tracks: [
      { name: "theme", path: "audio/theme.mp3" }
    ]
  }]
});

world.audio.observe(bg);
world.audio.volume = 0.5;
```

</details>

### 🖼️ UI

An orthographic 2D overlay drawn on top of the 3D scene.
UI elements are anchored to screen edges and support pointer interaction through signals.

- [UIRenderer](./docs/ui/ui-renderer.md) — orthographic camera and
  CSS2D overlay that drives the UI layer.
  - [UINode](./docs/ui/ui-node.md) — base positioning component with
    anchor, offset, and pivot.
  - [UISprite](./docs/ui/ui-sprite.md) — interactive sprite with
    style, hover states, text labels, and pointer signals.

## Contributors guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Once you have finished your development, check that the tests (and linter) are still good by running the following script:

```bash
$ npm run test
$ npm run lint
```

> [!CAUTION]
> In case you introduce a new feature or fix a bug, make sure to include tests for it as well.

### 📦 Internals

- [Adapters](./docs/internals/adapters.md)
- [Audio](./docs/internals/audio.md)
- [FixedTimeStep](./docs/internals/fixed-time-step.md)

## License

MIT

<!-- Reference-style links for DRYness -->

[ecs]: https://en.wikipedia.org/wiki/Entity_component_system
[superpowers]: https://github.com/superpowers
[craftstudio]: https://sparklinlabs.itch.io/craftstudio
[signals]: https://docs.godotengine.org/en/stable/getting_started/step_by_step/signals.html
[npm]: https://docs.npmjs.com/getting-started/what-is-npm
[yarn]: https://yarnpkg.com
[contributing]: ../../CONTRIBUTING.md


# actor-component.md

# ActorComponent

The engine follows an **Entity-Component** pattern inspired by
game engines like Unity and Godot:

- **Entity** → [Actor](actor.md) — a node in the scene tree with
  a transform, but no logic or rendering on its own.
- **Component** → `ActorComponent` — a modular piece of data or
  behavior attached to an actor. Each component adds one
  responsibility (rendering, physics, scripting, etc.).

An actor gains its capabilities entirely through the components
attached to it. For example, the same actor can display a 3D model
by attaching a `ModelRenderer` and react to player input by
attaching a custom [Behavior](../components/behavior.md). This
composition-over-inheritance approach keeps each piece small,
reusable, and testable in isolation.

The engine ships with several built-in components:

| Component | Role |
| --------- | ---- |
| [ModelRenderer](../components/renderers.md#modelrenderer) | Renders a 3D model (OBJ, FBX, glTF) |
| [SpriteRenderer](../components/renderers.md#spriterenderer) | Renders a 2D sprite / spritesheet |
| [TextRenderer](../components/renderers.md#textrenderer) | Renders 3D text |
| [Camera3DControls](../components/camera-3d-controls.md) | First-person camera with WASD + mouse look |
| [Behavior](../components/behavior.md) | Custom scripting with lifecycle hooks and decorators |

## Attaching components

Components are added to an actor with `addComponent` or
`addComponentAndGet`:

```ts
const actor = new Actor(world, { name: "Player" });

actor.addComponent(ModelRenderer, {
  model: knightModel
});

actor.addComponent(PlayerBehavior);
```

When constructed, a component automatically registers itself on
the actor's `components` list and is queued for its first `start()`
call on the next frame.

## Lifecycle

Components follow a lifecycle managed by the scene engine:

| Hook | When it runs |
| ---- | ------------ |
| `awake()` | Once, when the scene starts or when the actor is added |
| `start()` | Once, on the first frame after the component is created |
| `fixedUpdate(deltaTime)` | Every fixed step, at a constant rate (default 60 Hz). Use for physics and deterministic logic |
| `update(deltaTime)` | Every frame, receives the elapsed time in seconds. Use for rendering-related logic |
| `destroy()` | When the actor or component is removed from the scene |

Components that define `update()` or `fixedUpdate()` are
automatically registered for per-frame updates via the
`needUpdate` property. Setting `needUpdate = false` on a
component removes it from the update loop without destroying it.

## API

```ts
export type StrictComponentEnum =
  | "ScriptBehavior"
  | "Camera"
  | "VoxelRenderer"
  | "SpriteRenderer"
  | "ModelRenderer"
  | "TextRenderer";

export type FreeComponentEnum = StrictComponentEnum | (string & {});

interface ActorComponent {
  /** Sequential numeric identifier (per component class). */
  id: number;
  /** Persistent random hex identifier (16 characters). */
  persistentId: string;
  actor: Actor;
  typeName: FreeComponentEnum;

  /**
   * When true, the component receives update() and fixedUpdate()
   * calls. Automatically set when the component defines either
   * method. Set to false to pause updates without destroying.
   */
  needUpdate: boolean;

  /** Shortcut to `actor.world.context`. */
  get context(): TContext;

  isDestroyed(): boolean;

  /** Returns `"$typeName:$id-$persistentId"`. */
  toString(): string;

  // Remove the component from its actor
  destroy(): void;
}
```

## Accessing game context

The `context` getter provides a convenient shortcut to the
game instance context without navigating through `actor.world`:

```ts
class PlayerBehavior extends Behavior {
  update() {
    const { score } = this.context;
  }
}
```

## Events

`ActorComponent` extends `EventEmitter` and emits:

| Event | When it fires |
| ----- | ------------- |
| `metadataInitialized` | After all decorator metadata (properties, signals, component refs) has been resolved |

## See also

- [Behavior](../components/behavior.md)
- [Signal](../components/signal.md)


# actor-transform.md

# Transform

Wrapper around a `THREE.Object3D` that exposes a clean API for reading and
writing an actor's position, orientation, and scale in both local and global
space. Every `Actor` owns a `Transform` accessible via `actor.transform`.

All setters and mutating methods return `this` for chaining.
Getters accept an optional output object; when omitted a new instance is returned.

```ts
import * as THREE from "three";
import { Actor } from "@jolly-pixel/engine";

const actor = new Actor(world, "Player");

// Read global position (no pre-allocation needed)
const pos = actor.transform.getGlobalPosition();
console.log(pos.x, pos.y, pos.z);

// Or reuse an existing object
const reusable = new THREE.Vector3();
actor.transform.getGlobalPosition(reusable);

// Chain setters
actor.transform
  .setLocalPosition({ x: 0, y: 1, z: 0 })
  .setVisible(true);

// Move the actor 5 units forward
actor.transform.moveForward(5);

// Rotate 45° around the Y axis (global)
const rotation = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(0, 1, 0),
  Math.PI / 4
);
actor.transform.rotateGlobal(rotation);

// Make the actor look at a target
actor.transform.lookAt(new THREE.Vector3(10, 0, 10));

// Interpolate toward a target
actor.transform
  .lerpPosition({ x: 10, y: 0, z: 5 }, 0.1)
  .slerpOrientation(targetQuat, 0.1);
```

## TransformLike

Several methods accept a `TransformLike` instead of requiring a raw
`Transform`. This type is defined as:

```ts
type TransformLike = Transform | { transform: Transform };
```

Any object with a `.transform` property (such as `Actor`) satisfies
this type, so you can pass actors directly:

```ts
const dist = player.transform.distanceTo(enemy); // Actor works
player.transform.lookAt(enemy);                   // Actor works
player.transform.lookAt({ x: 10, y: 0, z: 5 });  // Vector3Like also works
```

### `Transform.resolveTransform(value): Transform` (static)

Extracts the `Transform` from a `TransformLike` value. Returns the
value itself if it is already a `Transform`, otherwise returns
`value.transform`.

## Visibility

### `getVisible(): boolean`

Returns `true` if the underlying `THREE.Object3D` is visible.

### `setVisible(visible): Transform`

Sets the visibility of the object. Returns `this` for chaining.

## Local Space

### `getLocalPosition(position?): Vector3`

Copies the local position into `position` and returns it.
When called without arguments, returns a new `Vector3`.

### `setLocalPosition(pos): Transform`

Sets the local position directly from `pos`. Returns `this`.

### `getLocalOrientation(orientation?): Quaternion`

Copies the local quaternion into `orientation` and returns it.
When called without arguments, returns a new `Quaternion`.

### `setLocalOrientation(quaternion): Transform`

Sets the local quaternion directly from `quaternion`. Returns `this`.

### `getLocalEulerAngles(angles?): Euler`

Copies the local Euler angles into `angles` and returns them.
When called without arguments, returns a new `Euler`.

### `setLocalEulerAngles(eulerAngles): Transform`

Sets the local orientation from Euler angles. Returns `this`.

### `getLocalScale(scale?): Vector3`

Copies the local scale into `scale` and returns it.
When called without arguments, returns a new `Vector3`.

### `setLocalScale(scale): Transform`

Sets the local scale directly from `scale`. Returns `this`.

### `moveLocal(offset): Transform`

Translates the object by `offset` in local (parent) space. Returns `this`.

### `moveOriented(offset): Transform`

Translates the object by `offset` oriented along the object's own
rotation. Useful for "move forward" style movement where the offset
is relative to the object's facing direction. Returns `this`.

### `rotateLocal(quaternion): Transform`

Applies a rotation in the object's local space. Returns `this`.

### `rotateLocalEulerAngles(eulerAngles): Transform`

Converts `eulerAngles` to a quaternion and applies a local rotation.
Returns `this`.

## Global Space

### `getGlobalMatrix(matrix?): Matrix4`

Copies the world matrix into `matrix` and returns it.
When called without arguments, returns a new `Matrix4`.

### `setGlobalMatrix(matrix): Transform`

Decomposes `matrix` into position, orientation, and scale, converting
from world space to local space relative to the parent. No-op if the
object has no parent. Returns `this`.

### `getGlobalPosition(position?): Vector3`

Extracts the world position into `position` and returns it.
When called without arguments, returns a new `Vector3`.

### `setGlobalPosition(pos): Transform`

Converts `pos` from world space to the parent's local space and
applies it. No-op if the object has no parent. Returns `this`.

### `getGlobalOrientation(orientation?): Quaternion`

Computes the world-space quaternion into `orientation` and returns it.
When called without arguments, returns a new `Quaternion`.

### `setGlobalOrientation(quaternion): Transform`

Converts a world-space `quaternion` to local space relative to the
parent and applies it. No-op if the object has no parent. Returns `this`.

### `getGlobalEulerAngles(angles?): Euler`

Computes the world-space Euler angles into `angles` and returns them.
When called without arguments, returns a new `Euler`.

### `setGlobalEulerAngles(eulerAngles): Transform`

Converts world-space Euler angles to a local quaternion relative to
the parent and applies it. No-op if the object has no parent.
Returns `this`.

### `getParentGlobalOrientation(): Quaternion`

Walks the ancestor chain and returns the accumulated world-space
quaternion of all parents (excluding the object itself).

### `moveGlobal(offset): Transform`

Translates the object by `offset` in world space. Returns `this`.

### `rotateGlobal(quaternion): Transform`

Applies a rotation in world space. The current global orientation is
pre-multiplied by `quaternion`. Returns `this`.

### `rotateGlobalEulerAngles(eulerAngles): Transform`

Converts `eulerAngles` to a quaternion and applies a global rotation.
Returns `this`.

### `lookAt(target, up?): Transform`

Rotates the object so it faces `target`. Accepts a world-space point
(`Vector3Like`), a `Transform`, or any object with a `.transform`
property (such as an `Actor`). An optional `up` vector can be provided;
defaults to the object's own up. Returns `this`.

### `lookTowards(direction, up?): Transform`

Rotates the object so its forward axis aligns with `direction`
(world-space direction vector). Internally calls `lookAt`.
Returns `this`.

## Direction Helpers

### `getForward(target?): Vector3`

Returns the object's local -Z axis in world space (Three.js convention).
When called without arguments, returns a new `Vector3`.

### `getRight(target?): Vector3`

Returns the object's local +X axis in world space.
When called without arguments, returns a new `Vector3`.

### `getUp(target?): Vector3`

Returns the object's local +Y axis in world space.
When called without arguments, returns a new `Vector3`.

### `moveForward(distance): Transform`

Moves the object along its forward direction by `distance` units.
Returns `this`.

### `moveRight(distance): Transform`

Moves the object along its right direction by `distance` units.
Returns `this`.

### `moveUp(distance): Transform`

Moves the object along its up direction by `distance` units.
Returns `this`.

## Utility

### `distanceTo(other): number`

Computes the world-space distance between this transform and `other`.
Accepts a `Transform` or any object with a `.transform` property
(such as an `Actor`).

### `lerpPosition(target, alpha): Transform`

Linearly interpolates the local position toward `target` by `alpha`
(0 = no change, 1 = snap to target). Returns `this`.

### `slerpOrientation(target, alpha): Transform`

Spherically interpolates the local orientation toward `target` by
`alpha` (0 = no change, 1 = snap to target). Returns `this`.


# actor-tree.md

# ActorTree

Hierarchical container that manages a collection of `Actor` nodes. It
provides depth-first traversal, pattern-based lookups (including glob
and path syntax), and lifecycle management (add, remove, destroy).
`Actor` itself extends `ActorTree`, so every actor doubles as a
sub-tree for its own children.

```ts
import { ActorTree } from "@jolly-pixel/engine";

const tree = new ActorTree();

// Iterate over root actors
for (const actor of tree.getRootActors()) {
  console.log(actor.name);
}

// Find a single actor by name
const player = tree.getActor("Player");

// Find a nested actor by path
const weapon = tree.getActor("Player/RightHand/Weapon");

// Find actors by glob pattern
for (const enemy of tree.getActors("Enemy_*")) {
  console.log(enemy.name);
}

// Deep glob — all descendants matching the pattern
for (const mesh of tree.getActors("Player/**/Mesh_*")) {
  console.log(mesh.name);
}

// Walk the full tree depth-first
for (const { actor, parent } of tree.walk()) {
  console.log(actor.name, "parent:", parent?.name ?? "root");
}
```

## Constructor

### `new ActorTree(options?)`

```ts
type ActorTreeNode = {
  actor: Actor;
  parent?: Actor;
};

interface ActorTreeOptions {
  addCallback?: (actor: Actor) => void;
  removeCallback?: (actor: Actor) => void;
}

new ActorTree(options?: ActorTreeOptions);
```

Creates a new tree. Optional callbacks are invoked whenever an actor
is added to or removed from this tree's direct `children` list.

The `children: Actor[]` property holds the list of direct child
actors managed by this tree.

### `add(actor)`

Appends `actor` to the `children` list and fires the `addCallback`
(if provided).

### `remove(actor)`

Removes `actor` from the `children` list and fires the
`removeCallback` (if provided). No-op if the actor is not a direct
child.

### `getActor(name): Actor | null`

Returns the first actor whose `name` matches exactly. Supports
path syntax with `/` separators to reach nested children
(e.g. `"Player/RightHand/Weapon"`). Returns `null` if no match is
found. Actors pending for destruction are excluded.

### `getActors(pattern): IterableIterator<Actor>`

Returns an iterator of all actors matching a glob `pattern`
(powered by picomatch). Supports:

- Simple globs — `"Enemy_*"`, `"Mesh_??"`.
- Path globs — `"Player/*/Mesh"`, `"**/Light_*"`.
- Double-star `**` — matches any depth of descendants.

Actors pending for destruction are excluded.

### `getRootActors(): IterableIterator<Actor>`

Yields the direct children, skipping any that are pending for
destruction.

### `getAllActors(): IterableIterator<Actor>`

Yields every actor in the tree via a depth-first walk (including
actors pending for destruction).

### `destroyActor(actor)`

Marks `actor` as pending for destruction. The actual cleanup is
handled by the game systems on the next frame.

### `destroyAllActors()`

Marks every actor in the tree as pending for destruction.

### `walk(): IterableIterator<ActorTreeNode>`

Performs a depth-first traversal of the entire tree, yielding
`{ actor, parent }` pairs starting from each root child.

### `walkFromNode(rootNode): IterableIterator<ActorTreeNode>`

Performs a depth-first traversal starting from `rootNode`'s
children, yielding `{ actor, parent }` pairs.

### `[Symbol.iterator](): IterableIterator<Actor>`

Makes the tree iterable with `for...of`. Yields direct children,
skipping any that are pending for destruction.

```ts
for (const actor of tree) {
  console.log(actor.name);
}
```

> [!NOTE]
> This is equivalent to getRootActors()


# actor.md

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
  .addComponent(ModelRenderer, { path: "models/knight.glb" })
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

When removing children, their geometry and materials are
automatically disposed:

```ts
actor.removeChildren(mesh);
```

On destruction, the actor traverses all remaining Three.js children
and disposes their GPU resources (geometry and materials) before
clearing the group.

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

## Destruction

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

## See also

- [ActorComponent](actor-component.md) — the component base type
- [ActorTree](actor-tree.md) — tree traversal and lookups
- [Transform](actor-transform.md) — position, rotation, and scale
- [Behavior](../components/behavior.md) — scripting with
  decorators and properties


# asset.md

# Asset Loading

The asset system provides a unified pipeline for loading external resources
(3D models, fonts, textures, audio, etc.). It is built around
two main concepts:

- **Asset** — lightweight descriptor that identifies a file by its
  path, name, extension, and type
- **AssetManager** — orchestrates the full lifecycle:
  enqueue → resolve loader → load → cache

A singleton `Assets` is exported from the engine and serves as the
default entry point for all asset operations.

```ts
import { Systems } from "@jolly-pixel/engine";

const { Assets } = Systems;
```

## Asset

A lightweight value object describing a single resource.

```ts
type AssetTypeName =
  | "unknown"
  | "texture"
  | "audio"
  | "model"
  | "font"
  | (string & {});
```

```ts
interface Asset {
  readonly id: string;
  name: string;
  ext: string;
  path: string;
  type: AssetTypeName;

  get basename(): string;
  get longExt(): string;
  toString(): string;
}
```

If no `type` is given at construction time, the manager resolves it
automatically from the file extension.

## AssetManager

Central façade that owns a loader registry, a waiting queue,
and the loaded-asset cache.

```ts
interface LazyAsset<T = unknown> {
  asset: Asset;
  get: () => T;
}
```

```ts
interface AssetManager {
  // Enqueue an asset and return a lazy handle.
  // Optional options are forwarded to the loader callback.
  load<T, TOptions>(assetOrPath: Asset | string, options?: TOptions): LazyAsset<T>;

  // Return a typed load function bound to this manager.
  lazyLoad<T, TOptions>(): (assetOrPath: Asset | string, options?: TOptions) => LazyAsset<T>;

  // Retrieve a previously loaded asset by path (throws if missing)
  get<T>(path: string): T;

  // Flush the queue: load every waiting asset in parallel
  loadAssets(context: AssetLoaderContext): Promise<void>;
}
```

## Loading lifecycle

1. **Register loaders** — each loader calls `Assets.registry.loader()`
   at module evaluation time, binding file extensions to a type and
   a loader callback.
2. **Enqueue assets** — game or component code calls `Assets.load(path)`.
   The asset is pushed into an internal queue and a `LazyAsset` handle
   is returned immediately.
3. **Flush the queue** — calling `Assets.loadAssets(context)` drains
   the queue and runs every registered loader in parallel. Each result
   is cached by asset path.
4. **Access the result** — call `lazyAsset.get()` to retrieve the
   loaded resource from the cache. Throws if the asset has not been
   loaded yet.

> [!NOTE]
> When `autoload` is `true`, `loadAssets` is scheduled automatically
> after each `load()` call, so you do not need to flush manually.

## Built-in loaders

The engine ships with three loaders. Each one registers itself
when its module is imported.

| Loader | Extensions | Result type |
| ------ | ---------- | ----------- |
| `Loaders.model` | `.obj`, `.fbx`, `.glb`, `.gltf` | `Model` (`THREE.Group` + `AnimationClip[]`) |
| `Loaders.font` | `.typeface.json` | `Font` (Three.js typeface) |

Usage:

```ts
import { Loaders } from "@jolly-pixel/engine";

// Enqueue assets
const knight = Loaders.model("models/knight.glb");
const myFont = Loaders.font("fonts/roboto.typeface.json");

// After loadAssets():
const { object, animations } = knight.get();
const font = myFont.get();
```

## Writing a custom loader

To add support for a new file format, register a loader on the
global `Assets.registry`:

```ts
import {
  Systems,
  type Asset,
  type AssetLoaderContext
} from "@jolly-pixel/engine";

const { Assets } = Systems;

Assets.registry.loader(
  {
    extensions: [".csv"],
    type: "spreadsheet"
  },
  async(asset: Asset, _context: AssetLoaderContext) => {
    const response = await fetch(asset.toString());
    const text = await response.text();

    return text
      .split("\n")
      .map((row) => row.split(","));
  }
);

export const spreadsheet = Assets.lazyLoad<string[][]>();
```

The `context.manager` property is the shared `THREE.LoadingManager`
instance, which can be passed to any Three.js loader to benefit from
centralized progress tracking.

## Per-load options

Loaders can accept a typed `options` argument that callers supply at
the `load()` call site. Options are forwarded as the third argument to
the loader callback.

**Register a loader with options:**

```ts
interface TilemapLoaderOptions {
  flipY?: boolean;
  baseDir?: string;
}

Assets.registry.loader<Tilemap, TilemapLoaderOptions>(
  { extensions: [".tmj", ".json"], type: "tilemap" },
  async(asset, context, options) => {
    // options is typed TilemapLoaderOptions | undefined
    const flipY = options?.flipY ?? false;
    // ...
  }
);

export const tilemap = Assets.lazyLoad<Tilemap, TilemapLoaderOptions>();
```

**Load with options:**

```ts
// Via lazyLoad helper — options are type-checked against TilemapLoaderOptions
const map = tilemap("levels/level1.tmj", { flipY: true });

// Or directly
const map2 = Assets.load<Tilemap, TilemapLoaderOptions>("levels/level1.tmj", { baseDir: "assets/" });
```


# audio-background.md

# AudioBackground

Playlist-based background music player. Supports multiple playlists
with configurable end behavior (stop, loop, chain to another playlist).
Implements `VolumeObserver` to react to master volume changes.

```ts
const audioManager = GlobalAudioManager.fromWorld(world);

const bg = new AudioBackground({
  audioManager,
  autoPlay: "ambient.forest",
  playlists: [
    {
      name: "ambient",
      onEnd: "loop",
      tracks: [
        { name: "forest", path: "/audio/forest.mp3" },
        { name: "rain", path: "/audio/rain.mp3", volume: 0.8 }
      ]
    },
    {
      name: "battle",
      onEnd: "play-next-playlist",
      nextPlaylistName: "ambient",
      tracks: [
        { name: "intro", path: "/audio/battle-intro.mp3" },
        { name: "loop", path: "/audio/battle-loop.mp3" }
      ]
    }
  ]
});

world.audio.observe(bg);

// Play by path ("playlistName.trackName")
await bg.play("ambient.forest");

// Play by index [playlistIndex, trackIndex]
await bg.play([1, 0]);

// Pause / resume
bg.pause();
await bg.play(); // resumes current track

// Skip to next track in the playlist
await bg.playNext();

// Stop playback and reset
bg.stop();
```

## Types

```ts
// Reference a track by "playlistName.trackName"
type AudioBackgroundSoundPath = `${string}.${string}`;
// Or by [playlistIndex, trackIndex]
type AudioBackgroundSoundIndex = [playlistIndex: number, trackIndex: number];

interface AudioBackgroundPlaylist {
  name: string;
  tracks: AudioBackgroundTrack[];
  // default "stop"
  onEnd?: "loop" | "stop" | "play-next-playlist";
  // Used when onEnd is "play-next-playlist"
  nextPlaylistName?: string;
}

interface AudioBackgroundTrack {
  name: string;
  path: string;
  // default 1
  volume?: number;
  metadata?: Record<string, any>;
}
```

## Properties & API

```ts
interface AudioBackground {
  playlists: AudioBackgroundPlaylist[];
  audio: THREE.Audio | null;

  readonly isPlaying: boolean;
  readonly isPaused: boolean;
  readonly track: AudioBackgroundTrack | null;

  play(pathOrIndex?: AudioBackgroundSoundPath | AudioBackgroundSoundIndex): Promise<void>;
  playNext(): Promise<void>;
  stop(): void;
  pause(): void;
  resume(): void;

  // VolumeObserver
  onMasterVolumeChange(volume: number): void;
}
```


# audio-library.md

# AudioLibrary

Named registry of pre-loaded `AudioBuffer` assets.

`AudioLibrary` bridges the asset system and the audio manager: you declare
audio files upfront (before `loadAssets` runs), and retrieve their decoded
`AudioBuffer` synchronously inside `Behavior.start()` or any other lifecycle
method. This keeps game code free of `await` and participates in the standard
pre-load phase and loading screen.

## Setup

Call `GlobalAudioManager.fromWorld(world)` first so that the audio loaders are
registered on `AssetManager`. Then use `AudioLibrary` to declare all files
you need before flushing the queue.

```ts
import { GlobalAudioManager, AudioLibrary, Systems } from "@jolly-pixel/engine";

const audioManager = GlobalAudioManager.fromWorld(world);

type SfxKey = "shoot" | "explosion" | "music";
const sfx = new AudioLibrary<SfxKey>();
sfx.register("shoot",     "sounds/shoot.mp3");
sfx.register("explosion", "sounds/explosion.mp3");
sfx.register("music",     "sounds/theme.ogg");

// Flush — all audio files are decoded in parallel here
await Systems.Assets.loadAssets(context);
```

## Usage in a Behavior

Once `loadAssets` has completed, `sfx.get()` returns the `AudioBuffer`
synchronously. Pass it to `createAudio` or `createPositionalAudio` to get a
configured `THREE.Audio` / `THREE.PositionalAudio` with no async:

```ts
class PlayerBehavior extends Behavior {
  #shootAudio: THREE.Audio;
  #music: THREE.Audio;

  start() {
    this.#shootAudio = audioManager.createAudio(sfx.get("shoot"), { volume: 0.8 });
    this.#music      = audioManager.createAudio(sfx.get("music"), { loop: true, volume: 0.5 });
    this.actor.add(this.#shootAudio);
  }

  update() {
    if (input.keyboard.wasJustPressed("Space")) {
      this.#shootAudio.play();
    }
  }
}
```

For 3D-positioned audio, use `createPositionalAudio` and add the node to the
actor that owns it:

```ts
this.#footsteps = audioManager.createPositionalAudio(sfx.get("footstep"), { loop: true });
this.actor.add(this.#footsteps);
```

## API

```ts
class AudioLibrary<TKeys extends string = string> {
  // Enqueue `path` in AssetManager and store it under `name`.
  // Must be called before AssetManager.loadAssets().
  register(name: TKeys, path: string): LazyAsset<AudioBuffer>;

  // Return the loaded AudioBuffer for `name`.
  // Throws if the name was never registered or loadAssets has not completed.
  get(name: TKeys): AudioBuffer;
}
```

> [!NOTE]
> `register` enqueues the file for loading but does not fetch it immediately.
> The buffer is only available after `Assets.loadAssets()` resolves.

## See also

- [Asset Loading](../asset.md)
- [Audio](audio.md)


# audio.md

# Audio

The audio system is built on top of Three.js Audio and provides three layers:

- **GlobalAudio** — master volume control, shared `AudioListener`
- **GlobalAudioManager** — load, configure, and destroy `Audio` / `PositionalAudio` instances
- **AudioBackground** — playlist-based background music with auto-advance, loop, and chaining

`GlobalAudio` is created automatically by `World` and exposed
as `world.audio`. The manager and background player are built on top of it.

## 🔇 Browser autoplay policy

Browsers block audio playback until the user has interacted with the page
(click, tap, key press). You must start playback from within a user gesture handler:

```ts
canvas.addEventListener("click", async() => {
  await audioBackground.play("ambient.forest");
});
```

> [!NOTE]
> This is a browser restriction, not an engine limitation.
> See [Chrome Autoplay Policy](https://developer.chrome.com/blog/autoplay/).

## GlobalAudio

Master volume controller. Wraps a Three.js `AudioListener` and notifies observers when the volume changes.

```ts
type GlobalAudioEvents = {
  volumechange: [volume: number];
};

interface VolumeObserver {
  onMasterVolumeChange: (volume: number) => void;
}
```

```ts
interface GlobalAudio {
  // The underlying Three.js AudioListener
  readonly listener: AudioListenerAdapter;
  readonly threeAudioListener: THREE.AudioListener;

  // Master volume (0 to 1)
  volume: number;

  // Register/unregister volume observers
  observe(observer: VolumeObserver): this;
  unobserve(observer: VolumeObserver): this;
}
```

## GlobalAudioManager

Loads audio files, configures volume/loop, and manages cleanup.

```ts
interface AudioLoadingOptions {
  name?: string;
  // default false
  loop?: boolean;
  // default 1
  volume?: number;
}
```

```ts
interface AudioManager {
  // Async — fetch + decode from a URL at runtime
  loadAudio(url: string, options?: AudioLoadingOptions): Promise<THREE.Audio>;
  loadPositionalAudio(url: string, options?: AudioLoadingOptions): Promise<THREE.PositionalAudio>;

  // Sync — construct from a buffer already loaded by AssetManager
  createAudio(buffer: AudioBuffer, options?: AudioLoadingOptions): THREE.Audio;
  createPositionalAudio(buffer: AudioBuffer, options?: AudioLoadingOptions): THREE.PositionalAudio;

  destroyAudio(audio: THREE.Audio | THREE.PositionalAudio): void;
}
```

### `fromWorld(world)`

Creates a `GlobalAudioManager` bound to the world's `AudioListener` and
registers audio loaders (`.mp3`, `.ogg`, `.wav`, `.aac`, `.flac`) on the
global `AssetManager` registry. Call once during game setup, before
`loadAssets` runs.

```ts
GlobalAudioManager.fromWorld(world: World): GlobalAudioManager;
```

### Async loading (`loadAudio` / `loadPositionalAudio`)

Fetches and decodes a URL on demand. Useful for audio that is loaded
dynamically at runtime (e.g. user-triggered sound effects loaded after the
loading screen).

```ts
const audio = await audioManager.loadAudio("sounds/click.mp3", { volume: 0.5 });
audio.play();
```

### Sync creation from pre-loaded buffers (`createAudio` / `createPositionalAudio`)

When buffers have been pre-loaded through `AssetManager` (e.g. via
`AudioLibrary`), these methods construct a ready-to-play `THREE.Audio` or
`THREE.PositionalAudio` synchronously — no `await` needed in lifecycle methods.

```ts
// In Behavior.start():
this.#shootAudio = audioManager.createAudio(sfx.get("shoot"), { volume: 0.8 });
this.#musicAudio = audioManager.createAudio(sfx.get("music"), { loop: true, volume: 0.5 });
this.actor.add(this.#shootAudio);
```

For 3D-positioned sound, use `createPositionalAudio` and add the result to
an `Actor`:

```ts
this.#footsteps = audioManager.createPositionalAudio(sfx.get("footstep"), { loop: true });
this.actor.add(this.#footsteps);
```

## See also

- [AudioBackground](audio-background.md)
- [AudioLibrary](audio-library.md)


# behavior.md

# Behavior

A `Behavior` is a specialized
[ActorComponent](../actor/actor-component.md) that adds scripting
capabilities to an Actor. It provides:

- **Actor registration** — each behavior registers itself on
  `actor.behaviors`, making it discoverable from other actors
- **Decorators** — declarative metadata for scene properties,
  component references, input listeners, and
  [signals](../actor/signal.md)

```ts
import {
  Behavior,
  type BehaviorProperties,
  ModelRenderer,
  Input,
  SceneProperty,
  SceneActorComponent,
  SignalEvent
} from "@jolly-pixel/engine";

export interface PlayerProperties extends BehaviorProperties {
  speed: number;
}

export class PlayerBehavior extends Behavior<PlayerProperties> {
  onPlayerPunch = new SignalEvent();

  @SceneProperty({ type: "number" })
  speed = 0.05;

  @SceneActorComponent(ModelRenderer)
  model: ModelRenderer;

  awake() {
    this.actor.object3D.rotateX(-Math.PI / 2);

    this.model.animation.setClipNameRewriter(
      (name) => name.slice(name.indexOf("|") + 1).toLowerCase()
    );
    this.model.animation.play("idle_loop");
    this.model.animation.setFadeDuration(0.25);
  }

  fixedUpdate() {
    const { input } = this.actor.world;

    if (input.isMouseButtonDown("left")) {
      this.onPlayerPunch.emit();
    }
  }

  update() {
    const { input } = this.actor.world;

    if (input.isMouseButtonDown("left")) {
      this.model.animation.play("punch_jab");
    }
    else {
      this.model.animation.play("idle_loop");
    }
  }
}
```

## Decorators

### `@SceneProperty`

Exposes a field as a configurable property in the scene editor.
Supported types: `string`, `number`, `boolean` (and their array
variants), `Vector2`, `Vector3`, `Vector4`, `Color`.

```ts
@SceneProperty({ type: "number", label: "Speed", description: "Movement speed" })
speed = 0.05;
```

### `@SceneActorComponent`

Binds a field to a sibling component on the same actor. The
component reference is resolved automatically during initialization.

```ts
@SceneActorComponent(ModelRenderer)
model: ModelRenderer;
```

### `@Input.listen`

Binds a method to an input event. The listener is wired
automatically during behavior initialization.

```ts
@Input.listen("keyboard.down")
onKeyDown(event: KeyboardEvent) {
  // …
}
```

## Properties

Behaviors support typed runtime properties through the generic
parameter `T extends BehaviorProperties`:

```ts
type BehaviorPropertiesValue =
  | string | string[]
  | number | number[]
  | boolean | boolean[]
  | THREE.Vector2
  | THREE.Vector3;

type BehaviorProperties = Record<string, BehaviorPropertiesValue>;
```

```ts
interface Behavior<T extends BehaviorProperties> {
  setProperty<K extends keyof T>(name: K, value: T[K]): void;
  getProperty<K extends keyof T>(name: K, defaultValue: T[K]): T[K];
  mergeProperties(defaults?: Partial<T>): void;
}
```

## See also

- [ActorComponent](../actor/actor-component.md)
- [Signal](./signal.md)


# camera-3d-controls.md

# Camera3DControls

A first-person camera controller built as a
[Behavior](behavior.md). It creates a `PerspectiveCamera`,
attaches the audio listener, and handles WASD movement with
mouse-look rotation.

## Usage

```ts
import { Actor, Camera3DControls } from "@jolly-pixel/engine";

const actor = new Actor(world, { name: "Camera" });
actor.addComponent(Camera3DControls, {
  speed: 15,
  rotationSpeed: 0.003,
  bindings: {
    forward: "KeyW",
    backward: "KeyS",
    left: "KeyA",
    right: "KeyD",
    up: "Space",
    down: "ShiftLeft",
    lookAround: "middle"
  }
});
```

## Options

```ts
interface Camera3DControlsOptions {
  speed?: number;
  rotationSpeed?: number;
  maxRollUp?: number;
  maxRollDown?: number;
  bindings?: {
    forward?: InputKeyboardAction;
    backward?: InputKeyboardAction;
    left?: InputKeyboardAction;
    right?: InputKeyboardAction;
    up?: InputKeyboardAction;
    down?: InputKeyboardAction;
    lookAround?: MouseEventButton;
  };
}
```

| Option | Default | Description |
| ------ | ------- | ----------- |
| `speed` | `20` | Movement speed |
| `rotationSpeed` | `0.004` | Mouse look sensitivity |
| `maxRollUp` | `π / 2` | Maximum upward pitch (radians) |
| `maxRollDown` | `-π / 2` | Maximum downward pitch (radians) |
| `bindings` | WASD + Space/Shift + middle mouse | Key and mouse bindings |

## Runtime properties

```ts
interface Camera3DControls {
  // The underlying Three.js camera
  camera: THREE.PerspectiveCamera;

  // Change movement speed at runtime
  set speed(value: number);

  // Change rotation speed at runtime
  set rollSpeed(value: number);
}
```

## See also

- [Behavior](behavior.md)
- [ActorComponent](../actor/actor-component.md)


# renderers.md

# Renderers

The engine ships with four built-in renderer components. Each one
extends [ActorComponent](../actor/actor-component.md) and handles
loading, displaying, and cleaning up a specific type of visual
asset.

## ModelRenderer

Renders a 3D model loaded from an OBJ, FBX, or glTF file.
The model is added to the actor's Three.js group on `awake` and
removed on `destroy`.

```ts
import { Actor, ModelRenderer } from "@jolly-pixel/engine";

const actor = new Actor(world, { name: "Knight" });
actor.addComponent(ModelRenderer, {
  path: "models/knight.glb",
  animations: {
    default: "idle",
    clipNameRewriter: (name) => name.toLowerCase()
  }
});
```

| Option | Default | Description |
| ------ | ------- | ----------- |
| `path` | — | Path to the model file (`.obj`, `.fbx`, `.glb`, `.gltf`) |
| `debug` | `false` | Log loaded object and animations to the console |
| `animations.default` | — | Name of the animation clip to play on start |
| `animations.clipNameRewriter` | identity | Transforms clip names before storing them |

Every `ModelRenderer` exposes an `animation` property that
controls clip playback with crossfade transitions:

```ts
const renderer = actor.addComponentAndGet(ModelRenderer, {
  path: "models/knight.glb"
});

renderer.animation.setFadeDuration(0.25);
renderer.animation.play("walk");
renderer.animation.stop();
```

## SpriteRenderer

Renders a 2D sprite from a spritesheet texture. Supports
frame-based animation, horizontal/vertical flipping, and opacity.

```ts
import { Actor, SpriteRenderer } from "@jolly-pixel/engine";

const actor = new Actor(world, { name: "Player" });
actor.addComponent(SpriteRenderer, {
  texture: "textures/player.png",
  tileHorizontal: 8,
  tileVertical: 4,
  animations: {
    walk: { from: 0, to: 7 },
    jump: [8, 9, 10, 11]
  }
});
```

| Option | Default | Description |
| ------ | ------- | ----------- |
| `texture` | — | Path to the spritesheet image |
| `tileHorizontal` | — | Number of columns in the spritesheet |
| `tileVertical` | — | Number of rows in the spritesheet |
| `animations` | `{}` | Named animation definitions (frame arrays or ranges) |
| `flip.horizontal` | `false` | Mirror the sprite horizontally |
| `flip.vertical` | `false` | Mirror the sprite vertically |

Runtime helpers:

```ts
const sprite = actor.addComponentAndGet(SpriteRenderer, {
  texture: "textures/hero.png",
  tileHorizontal: 6,
  tileVertical: 2,
  animations: { run: { from: 0, to: 5 } }
});

sprite.setFrame(3);
sprite.setHorizontalFlip(true);
sprite.setOpacity(0.8);
sprite.animation.play("run", { duration: 0.6, loop: true });
```

## TextRenderer

Renders 3D extruded text using a Three.js typeface font
(`.typeface.json`).

```ts
import * as THREE from "three";
import { Actor, TextRenderer } from "@jolly-pixel/engine";

const actor = new Actor(world, { name: "Title" });
actor.addComponent(TextRenderer, {
  path: "fonts/roboto.typeface.json",
  text: "Hello World",
  material: new THREE.MeshStandardMaterial({ color: 0xffffff }),
  textGeometryOptions: { size: 2, depth: 0.5 }
});
```

| Option | Default | Description |
| ------ | ------- | ----------- |
| `path` | — | Path to the `.typeface.json` font file |
| `text` | `""` | Initial text to display |
| `material` | `MeshBasicMaterial` | Material applied to the text mesh |
| `textGeometryOptions` | `{ size: 1, depth: 1 }` | Three.js `TextGeometry` parameters |

To update the text at runtime, use the `text` property and call
`updateMesh()`:

```ts
const renderer = actor.addComponentAndGet(TextRenderer, {
  path: "fonts/roboto.typeface.json"
});

renderer.text.setValue("Score: 100");
renderer.updateMesh();
```

## See also

- [ActorComponent](../actor/actor-component.md)
- [Camera3DControls](camera-3d-controls.md)
- [Behavior](behavior.md)
- [Asset Loading](../asset.md)


# signal.md

# Signal

Inspired by [Godot's signals](https://docs.godotengine.org/en/stable/getting_started/step_by_step/signals.html),
signals are a lightweight pub/sub mechanism for communication
between [behaviors](../components/behavior.md).

## Declaring a signal

```ts
import {
  Behavior,
  SignalEvent
} from "@jolly-pixel/engine";

export class PlayerBehavior extends Behavior {
  onPlayerPunch = new SignalEvent();

  update() {
    if (this.actor.world.input.isMouseButtonDown("left")) {
      this.onPlayerPunch.emit();
    }
  }
}
```

## Listening to a signal

Other behaviors can subscribe to a signal with `connect` and
unsubscribe with `disconnect`:

```ts
const player = actor.getComponent(PlayerBehavior)!;

player.onPlayerPunch.connect(() => {
  console.log("Player punched!");
});
```

## SignalEvent API

```ts
interface SignalEvent<T extends unknown[] = []> {
  // Notify all connected listeners
  emit(...args: T): void;

  // Subscribe a listener
  connect(listener: SignalListener<T>): void;

  // Unsubscribe a listener
  disconnect(listener: SignalListener<T>): void;

  // Remove all listeners
  clear(): void;
}

type SignalListener<T extends unknown[]> = (...args: T[]) => void;
```

## Typed signals

`SignalEvent` accepts a generic tuple to type the emitted arguments:

```ts
onDamage = new SignalEvent<[amount: number, source: string]>();

// Emit with typed arguments
this.onDamage.emit(10, "fireball");

// Listener receives typed parameters
behavior.onDamage.connect((amount, source) => {
  console.log(`Took ${amount} damage from ${source}`);
});
```

## See also

- [Behavior](./behavior.md)
- [ActorComponent](../actor/actor-component.md)


# combinedinput.md

# CombinedInput

Declarative input combination system that lets you compose complex input
conditions from simple building blocks. Build key chords, alternative
bindings, exclusion lists, and input sequences using a fluent API
powered by the `InputCombination` factory.

```ts
import { InputCombination, Input } from "@jolly-pixel/engine";

const canvas = document.querySelector("canvas")!;
const input = new Input(canvas);
input.connect();

// Single key press
const jump = InputCombination.key("Space");

// Ctrl + S chord (both must be active)
const save = InputCombination.all("ControlLeft.down", "KeyS.pressed");

// WASD or Arrow keys (any one triggers it)
const moveUp = InputCombination.atLeastOne("KeyW.down", "ArrowUp.down");

// Left-click only when Shift is NOT held
const selectSingle = InputCombination.all(
  InputCombination.mouse("left", "pressed"),
  InputCombination.none("ShiftLeft.down")
);

// Konami-style sequence
const combo = InputCombination.sequence(
  "ArrowUp.pressed",
  "ArrowUp.pressed",
  "ArrowDown.pressed",
  "ArrowDown.pressed"
);

function gameLoop() {
  input.update();

  if (jump.evaluate(input)) {
    console.log("Jump!");
  }
  if (save.evaluate(input)) {
    console.log("Save!");
  }
  if (moveUp.evaluate(input)) {
    console.log("Moving up");
  }
  if (selectSingle.evaluate(input)) {
    console.log("Single select");
  }
  if (combo.evaluate(input)) {
    console.log("Combo activated!");
  }

  requestAnimationFrame(gameLoop);
}

gameLoop();
```

## InputCondition Interface

Every condition returned by `InputCombination` implements this interface:

```ts
interface InputCondition {
  evaluate(input: Input): boolean;
  reset(): void;
}
```

### `evaluate(input): boolean`

Returns `true` when the condition is satisfied for the current frame.

### `reset()`

Reset internal state (relevant for stateful conditions like sequences).

## InputCombination

Static factory class used to create all input conditions.

## Atomic Conditions

### `InputCombination.key(action)`

Create a keyboard condition from a combined action string.

```ts
InputCombination.key("Space.pressed");
InputCombination.key("KeyW.down");
InputCombination.key("ShiftLeft.released");
```

### `InputCombination.key(key, state?)`

Create a keyboard condition with an explicit key code and state.
Defaults to `"pressed"` when `state` is omitted.

```ts
InputCombination.key("Space");
InputCombination.key("KeyW", "down");
```

### `InputCombination.mouse(action)`

Create a mouse button condition from a combined action string.

```ts
InputCombination.mouse("left.pressed");
InputCombination.mouse("right.down");
```

### `InputCombination.mouse(button, state?)`

Create a mouse button condition with an explicit button and state.
Defaults to `"pressed"` when `state` is omitted.

```ts
InputCombination.mouse("left");
InputCombination.mouse("right", "down");
```

### `InputCombination.gamepad(gamepad, button, state?)`

Create a gamepad button condition. Defaults to `"pressed"` when `state`
is omitted.

```ts
InputCombination.gamepad(0, "A");
InputCombination.gamepad(0, "LeftBumper", "down");
```

## Composite Conditions

### `InputCombination.all(...conditions)`

Returns a condition that is satisfied when **all** child conditions are
satisfied simultaneously. Useful for key chords and modifier combinations.

Accepts `InputCondition` objects or `CombinedInputAction` shorthand strings.

```ts
// Ctrl + Shift + S
InputCombination.all("ControlLeft.down", "ShiftLeft.down", "KeyS.pressed");

// Mixed condition objects and strings
InputCombination.all(
  InputCombination.mouse("left", "pressed"),
  "ShiftLeft.down"
);
```

### `InputCombination.atLeastOne(...conditions)`

Returns a condition that is satisfied when **at least one** child condition
is satisfied. Useful for alternative bindings.

```ts
// Accept either WASD or Arrow key
InputCombination.atLeastOne("KeyW.down", "ArrowUp.down");
```

### `InputCombination.none(...conditions)`

Returns a condition that is satisfied when **none** of the child conditions
are satisfied. Useful for exclusion guards.

```ts
// True only when neither Shift key is held
InputCombination.none("ShiftLeft.down", "ShiftRight.down");
```

### `InputCombination.sequence(...conditions)`

Returns a condition that is satisfied when all child conditions are triggered
**in order** within a default timeout (100 ms between each step).

```ts
InputCombination.sequence(
  "ArrowUp.pressed",
  "ArrowDown.pressed",
  "ArrowUp.pressed"
);
```

### `InputCombination.sequenceWithTimeout(timeoutMs, ...conditions)`

Same as `sequence` but with a custom timeout between each step.

```ts
InputCombination.sequenceWithTimeout(
  500,
  "KeyA.pressed",
  "KeyB.pressed",
  "KeyC.pressed"
);
```

## Types

```ts
type CombinedInputState = "down" | "pressed" | "released";

type CombinedInputAction =
  `${ExtendedKeyCode | MouseAction}.${CombinedInputState}`;

type MouseAction =
  | "left" | "middle" | "right"
  | "back" | "forward"
  | "scrollUp" | "scrollDown";

type GamepadIndex = 0 | 1 | 2 | 3;

type GamepadButton =
  | "A" | "B" | "X" | "Y"
  | "LeftBumper" | "RightBumper"
  | "LeftTrigger" | "RightTrigger"
  | "Select" | "Start"
  | "LeftStick" | "RightStick"
  | "DPadUp" | "DPadDown" | "DPadLeft" | "DPadRight"
  | "Home";
```

## State Meanings

| State | Meaning |
| ------------ | ---------------------------------------- |
| `"down"` | `true` while the button/key is held |
| `"pressed"` | `true` only on the frame it was pressed |
| `"released"` | `true` only on the frame it was released |


# gamepad.md

# Gamepad

Gamepad input handler supporting up to 4 controllers. Tracks button state,
analog stick axes with dead zone, and axis auto-repeat for menu navigation.

Automatically connected and polled by `Input`, but can also be used standalone.

```ts
import { Gamepad, GamepadButton, GamepadAxis } from "@jolly-pixel/engine";

const gamepad = new Gamepad();

gamepad.connect();
gamepad.on("connect", (pad) => console.log("connected", pad.id));

function gameLoop() {
  gamepad.update();

  if (gamepad.buttons[0][GamepadButton.A].wasJustPressed) {
    console.log("Player 1 pressed A!");
  }

  const stickX = gamepad.axes[0][GamepadAxis.LeftStickX].value;
  if (stickX !== 0) {
    console.log("Left stick X:", stickX);
  }

  requestAnimationFrame(gameLoop);
}

gameLoop();
```

## Constructor

### `new Gamepad(options?)`

```ts
interface GamepadOptions {
  navigatorAdapter?: NavigatorAdapter;
  windowAdapter?: WindowAdapter;
}

new Gamepad(options?: GamepadOptions);
```

## Types

```ts
type GamepadIndex = 0 | 1 | 2 | 3;

// W3C Standard Gamepad button mapping
// @see https://w3c.github.io/gamepad/#remapping
const GamepadButton = {
  // Face buttons
  A: 0,        // Xbox: A, PlayStation: Cross
  B: 1,        // Xbox: B, PlayStation: Circle
  X: 2,        // Xbox: X, PlayStation: Square
  Y: 3,        // Xbox: Y, PlayStation: Triangle
  // Shoulder buttons
  LeftBumper: 4,   // L1
  RightBumper: 5,  // R1
  LeftTrigger: 6,  // L2
  RightTrigger: 7, // R2
  // Center buttons
  Select: 8,       // Back/Share
  Start: 9,        // Start/Options
  // Stick buttons
  LeftStick: 10,   // L3
  RightStick: 11,  // R3
  // D-Pad
  DPadUp: 12,
  DPadDown: 13,
  DPadLeft: 14,
  DPadRight: 15,
  // Special
  Home: 16
} as const;

// Axis values range from -1.0 (left/up) to 1.0 (right/down)
const GamepadAxis = {
  LeftStickX: 0,
  LeftStickY: 1,
  RightStickX: 2,
  RightStickY: 3
} as const;

interface GamepadButtonState {
  isDown: boolean;
  wasJustPressed: boolean;
  wasJustReleased: boolean;
  value: number;
}

interface GamepadAxisState {
  wasPositiveJustPressed: boolean;
  wasPositiveJustAutoRepeated: boolean;
  wasPositiveJustReleased: boolean;
  wasNegativeJustPressed: boolean;
  wasNegativeJustAutoRepeated: boolean;
  wasNegativeJustReleased: boolean;
  value: number;
}

interface GamepadAutoRepeat {
  axis: number;
  positive: boolean;
  time: number;
}
```

## Events

```ts
type GamepadEvents = {
  connect: [gamepad: globalThis.Gamepad];
  disconnect: [gamepad: globalThis.Gamepad];
};
```

## Properties

```ts
interface Gamepad {
  static readonly MaxGamepads: 4;
  static readonly MaxButtons: 16;
  static readonly MaxAxes: 4;

  // Per-gamepad, per-button state
  buttons: GamepadButtonState[][];
  // Per-gamepad, per-axis state
  axes: GamepadAxisState[][];
  // Per-gamepad auto-repeat tracking (for held axes)
  autoRepeats: (GamepadAutoRepeat | null)[];

  // Number of currently connected controllers
  connectedGamepads: number;

  // Dead zone threshold for analog sticks (default 0.25)
  axisDeadZone: number;
  // Delay before first auto-repeat in ms (default 500)
  axisAutoRepeatDelayMs: number;
  // Interval between auto-repeats in ms (default 33)
  axisAutoRepeatRateMs: number;

  readonly wasActive: boolean;
}
```

## API

```ts
interface Gamepad {
  // Lifecycle
  connect(): void;
  disconnect(): void;
  reset(): void;
  update(): void;
}
```


# input.md

# Input

Unified input manager that aggregates mouse, keyboard, gamepad, and touchpad
into a single high-level API. Handles device detection, preference switching,
pointer locking, fullscreen, and provides per-frame state queries
(is down, just pressed, just released).

```ts
import { Input } from "@jolly-pixel/engine";

const canvas = document.querySelector("canvas")!;
const input = new Input(canvas);

input.connect();

function gameLoop() {
  input.update();

  if (input.wasKeyJustPressed("Space")) {
    console.log("Jump!");
  }
  if (input.isMouseButtonDown("left")) {
    const delta = input.getMouseDelta(true);
    console.log("Dragging", delta.x, delta.y);
  }

  requestAnimationFrame(gameLoop);
}

gameLoop();
```

## Device APIs

Each device is available as a property on the `Input` instance
(`input.mouse`, `input.keyboard`, `input.gamepad`, `input.touchpad`,
`input.screen`) and can also be used standalone.

- [Mouse](mouse.md)
- [Keyboard](keyboard.md)
- [Gamepad](gamepad.md)
- [Touchpad](touchpad.md)
- [Screen](screen.md)

## Constructor

### `new Input(canvas, options?)`

```ts
interface InputOptions {
  // Emit an "exit" event on window.onbeforeunload
  enableOnExit?: boolean;
  // Custom window adapter (defaults to BrowserWindowAdapter)
  windowAdapter?: WindowAdapter;
}

new Input(canvas: HTMLCanvasElement, options?: InputOptions);
```

## Lifecycle

### `connect()`

Register all DOM event listeners for every device (mouse, keyboard,
gamepad, touchpad, screen). Must be called before `update()`.

### `disconnect()`

Remove all DOM event listeners. Call when tearing down the game loop.

### `update()`

Poll every device and flush per-frame state (just pressed / just released).
Call once per frame **before** querying input state.

## Events

`Input` extends `EventEmitter` and emits the following events:

```ts
type InputDevicePreference = "default" | "gamepad";

type InputEvents = {
  // Fired on window.onbeforeunload (requires enableOnExit)
  exit: [];
  // Fired when active device switches between "default" (mouse + keyboard) and "gamepad"
  devicePreferenceChange: [preference: InputDevicePreference];
};
```

## Decorator

### `Input.listen(type)`

Method decorator that registers a behavior method as a listener for an
input event. Used with `reflect-metadata`.

```ts
class PlayerBehavior {
  @Input.listen("keyboard.down")
  onKeyDown() {
    // ...
  }
}
```

Available listener types:

- `mouse.down`
- `mouse.up`
- `mouse.move`
- `mouse.wheel`
- `mouse.lockStateChange`
- `keyboard.down`
- `keyboard.up`
- `keyboard.press`
- `keyboard.<KeyCode>`
- `gamepad.connect`
- `gamepad.disconnect`
- `touchpad.start`
- `touchpad.move`
- `touchpad.end`
- `screen.stateChange`
- `input.devicePreferenceChange`
- `input.exit`

## Screen

### `enterFullscreen()`

Request fullscreen on the canvas element.

### `exitFullscreen()`

Exit fullscreen mode.

### `getScreenSize(): Vector2`

Returns canvas client dimensions as a `THREE.Vector2`.

### `getScreenBounds(): { left, right, top, bottom }`

Returns screen bounds centered at origin (useful for orthographic cameras).

## Mouse

### `getMousePosition(): Vector2`

Returns mouse position normalized to `[-1, 1]` on both axes.

### `getMouseWorldPosition(): Vector2`

Returns mouse position in world-space pixels, centered at origin.

### `getMouseDelta(normalizeWithSize?): Vector2`

Returns mouse movement delta since last frame.
When `normalizeWithSize` is `true`, the delta is divided by half the canvas
dimensions.

### `isMouseMoving(): boolean`

Returns `true` if the mouse moved during the current frame.

### `isMouseButtonDown(action): boolean`

Returns `true` while the given button is held.

### `wasMouseButtonJustPressed(action): boolean`

Returns `true` only on the frame the button was pressed.

### `wasMouseButtonJustReleased(action): boolean`

Returns `true` only on the frame the button was released.

### `lockMouse()` / `unlockMouse()`

Request or release pointer lock on the canvas.

### `getMouseVisible(): boolean` / `setMouseVisible(visible)`

Get or set cursor visibility.

```ts
type InputMouseAction =
  | "left" | "middle" | "right" | "back" | "forward"
  | number
  | "ANY" | "NONE";
```

## Keyboard

### `isKeyDown(key): boolean`

Returns `true` while the key is held.

### `wasKeyJustPressed(key): boolean`

Returns `true` only on the frame the key was pressed.

### `wasKeyJustReleased(key): boolean`

Returns `true` only on the frame the key was released.

### `wasKeyJustAutoRepeated(key): boolean`

Returns `true` on auto-repeat frames (held key).

### `getTextEntered(): string`

Returns the character typed during the current frame (if any).

```ts
type InputKeyboardAction = KeyCode | "ANY" | "NONE";
```

## Touchpad

### `isTouchDown(index): boolean`

Returns `true` while the touch point is active.

### `wasTouchStarted(index): boolean`

Returns `true` on the frame the touch began.

### `wasTouchEnded(index): boolean`

Returns `true` on the frame the touch ended.

### `getTouchPosition(index): Vector2`

Returns touch position normalized to `[-1, 1]`.

### `isTouchpadAvailable(): boolean`

Returns `true` if the device supports touch events.

## Gamepad

### `isGamepadButtonDown(gamepad, button): boolean`

Returns `true` while the button is held.

### `wasGamepadButtonJustPressed(gamepad, button): boolean`

Returns `true` only on the frame the button was pressed.

### `wasGamepadButtonJustReleased(gamepad, button): boolean`

Returns `true` only on the frame the button was released.

### `getGamepadButtonValue(gamepad, button): number`

Returns the analog value of a button (`0` to `1`).

### `getGamepadAxisValue(gamepad, axis): number`

Returns the current axis value (`-1` to `1`).

### `wasGamepadAxisJustPressed(gamepad, axis, options?): boolean`

Returns `true` when an axis crosses the dead zone threshold.

```ts
interface GamepadAxisPressOptions {
  // Check positive direction instead of negative
  positive?: boolean;
  // Include auto-repeat frames
  autoRepeat?: boolean;
}
```

### `wasGamepadAxisJustReleased(gamepad, axis, options?): boolean`

Returns `true` when an axis returns inside the dead zone.

### `setGamepadAxisDeadZone(deadZone)` / `getGamepadAxisDeadZone(): number`

Set or get the dead zone threshold for all axes.

```ts
type GamepadIndex = 0 | 1 | 2 | 3;

type GamepadButton =
  | "A" | "B" | "X" | "Y"
  | "LeftBumper" | "RightBumper" | "LeftTrigger" | "RightTrigger"
  | "Select" | "Start"
  | "LeftStick" | "RightStick"
  | "DPadUp" | "DPadDown" | "DPadLeft" | "DPadRight"
  | "Home"
  | number;

type GamepadAxis =
  | "LeftStickX" | "LeftStickY"
  | "RightStickX" | "RightStickY"
  | number;
```

## Misc

### `vibrate(pattern)`

Trigger device vibration via `navigator.vibrate()`.

### `getDevicePreference(): InputDevicePreference`

Returns `"default"` (mouse + keyboard) or `"gamepad"` based on which device
was last active.


# keyboard.md

# Keyboard

Low-level keyboard device. Tracks per-key state (down, just pressed,
just released, auto-repeat) and text input.

Automatically connected and polled by `Input`, but can also be used standalone.

```ts
import { Keyboard } from "@jolly-pixel/engine";

const keyboard = new Keyboard();

keyboard.connect();
keyboard.on("down", (event) => console.log("key", event.code));

function gameLoop() {
  keyboard.update();

  const spaceState = keyboard.buttons.get("Space");
  if (spaceState?.wasJustPressed) {
    console.log("Space pressed!");
  }

  const typed = keyboard.char;
  if (typed) {
    console.log("Typed:", typed);
  }

  requestAnimationFrame(gameLoop);
}

gameLoop();
```

## Constructor

### `new Keyboard(options?)`

```ts
interface KeyboardOptions {
  // Custom document adapter (defaults to BrowserDocumentAdapter)
  documentAdapter?: DocumentAdapter;
}

new Keyboard(options?: KeyboardOptions);
```

## Types

```ts
interface KeyState {
  isDown: boolean;
  wasJustPressed: boolean;
  wasJustAutoRepeated: boolean;
  wasJustReleased: boolean;
}

// KeyCode is the physical key code (e.g. "KeyA", "Space", "ArrowUp")
// ExtendedKeyCode adds modifier-aware aliases
type KeyCode = string;
type ExtendedKeyCode = string;
```

## Events

```ts
type KeyboardEvents = {
  down: [event: KeyboardEvent];
  up: [event: KeyboardEvent];
  // Fired for printable characters (charCode >= 32)
  press: [event: KeyboardEvent];
  // Per-key event using event.code (e.g. "Space", "KeyA")
  [key: string]: [event: KeyboardEvent];
};
```

## Properties

```ts
interface Keyboard {
  // Per-key state keyed by event.code
  buttons: Map<string, KeyState>;
  // Currently held keys
  buttonsDown: Set<string>;
  // Characters typed during the current frame
  char: string;

  readonly wasActive: boolean;
}
```

## API

```ts
interface Keyboard {
  // Lifecycle
  connect(): void;
  disconnect(): void;
  reset(): void;
  update(): void;
}
```


# mouse.md

# Mouse

Low-level mouse device. Tracks button state, position, movement delta,
scroll wheel, pointer lock, and double-click.

Automatically connected and polled by `Input`, but can also be used standalone.

```ts
import {
  Mouse,
  MouseEventButton
  } from "@jolly-pixel/engine";

const canvas = document.querySelector("canvas")!;
const mouse = new Mouse({ canvas });

mouse.connect();
mouse.on("down", (event) => console.log("button", event.button));
mouse.on("wheel", (event) => {
  const [dx, dy] = Mouse.getWheelDelta(event);
  console.log("scroll", dx, dy);
});

function gameLoop() {
  mouse.update();

  if (mouse.buttons[MouseEventButton.left].wasJustPressed) {
    console.log("Left click!");
  }

  requestAnimationFrame(gameLoop);
}

gameLoop();
```

## Constructor

### `new Mouse(options)`

```ts
interface MouseOptions {
  canvas: CanvasAdapter;
  // Custom document adapter (defaults to BrowserDocumentAdapter)
  documentAdapter?: DocumentAdapter;
}

new Mouse(options: MouseOptions);
```

## Types

```ts
const MouseEventButton = {
  left: 0,
  middle: 1,
  right: 2,
  back: 3,
  forward: 4,
  scrollUp: 5,
  scrollDown: 6
} as const;

type MouseAction = keyof typeof MouseEventButton;

type MouseLockState = "locked" | "unlocked";

interface MouseButtonState {
  isDown: boolean;
  doubleClicked: boolean;
  wasJustPressed: boolean;
  wasJustReleased: boolean;
}
```

## Events

```ts
type MouseEvents = {
  lockStateChange: [MouseLockState];
  down: [event: MouseEvent];
  up: [event: MouseEvent];
  move: [event: MouseEvent];
  wheel: [event: WheelEvent];
};
```

## Properties

```ts
interface Mouse {
  // Per-button state indexed by MouseEventButton values
  buttons: MouseButtonState[];
  // Raw down state, written immediately on DOM events
  buttonsDown: boolean[];

  // Canvas-local position in pixels (read-only)
  readonly position: { x: number; y: number };
  // Movement delta since last update() (read-only)
  readonly delta: { x: number; y: number };

  readonly locked: boolean;
  readonly scrollUp: boolean;
  readonly scrollDown: boolean;
  readonly wasActive: boolean;
}
```

## API

```ts
interface Mouse {
  // Lifecycle
  connect(): void;
  disconnect(): void;
  reset(): void;
  update(): void;

  // Pointer lock
  lock(): void;
  unlock(): void;

  // Mirror primary touch into mouse state (left button + position)
  synchronizeWithTouch(
    touch: Touch,
    buttonValue?: boolean,
    position?: TouchPosition
  ): void;
}

// Normalize WheelEvent across browsers and platforms
static getWheelDelta(event: WheelEvent): [number, number];
```


# screen.md

# Screen

Fullscreen manager. Requests and exits fullscreen mode on the canvas,
tracks state changes, and handles errors.

Automatically connected by `Input`, but can also be used standalone.

```ts
import { Screen } from "@jolly-pixel/engine";

const canvas = document.querySelector("canvas")!;
const screen = new Screen({ canvas });

screen.connect();
screen.on("stateChange", (state) => {
  console.log("fullscreen", state);
});

// Fullscreen is acquired on the next mouse down
screen.enter();
```

## Constructor

### `new Screen(options)`

```ts
interface ScreenOptions {
  canvas: CanvasAdapter;
  // Custom document adapter (defaults to BrowserDocumentAdapter)
  documentAdapter?: DocumentAdapter;
}

new Screen(options: ScreenOptions);
```

## Types

```ts
type FullscreenState = "active" | "suspended";
```

## Events

```ts
type ScreenEvents = {
  stateChange: [FullscreenState];
};
```

## Properties

```ts
interface Screen {
  // Whether fullscreen has been requested
  wantsFullscreen: boolean;
  // Whether the canvas is currently fullscreen
  wasFullscreen: boolean;
}
```

## API

```ts
interface Screen {
  // Lifecycle
  connect(): void;
  disconnect(): void;
  reset(): void;

  // Request fullscreen (acquired on next mouse down)
  enter(): void;
  // Exit fullscreen and reset state
  exit(): void;

  // Called by Input to trigger fullscreen on mouse interaction
  onMouseDown(): void;
  onMouseUp(): void;
}
```


# touchpad.md

# Touchpad

Multi-touch input handler. Tracks up to 10 simultaneous touch points
with per-finger state (down, started, ended, position).

Automatically connected and polled by `Input`, but can also be used standalone.

```ts
import { Touchpad, TouchIdentifier } from "@jolly-pixel/engine";

const canvas = document.querySelector("canvas")!;
const touchpad = new Touchpad({ canvas });

touchpad.connect();
touchpad.on("start", (touch, position) => {
  console.log("touch", touch.identifier, position);
});

function gameLoop() {
  touchpad.update();

  if (touchpad.getTouchState(TouchIdentifier.primary).wasStarted) {
    console.log("Primary finger down!");
  }
  if (touchpad.isTwoFingerGesture) {
    console.log("Pinch / two-finger gesture");
  }

  requestAnimationFrame(gameLoop);
}

gameLoop();
```

> [!NOTE]
> Most browsers (Chrome, Edge, Safari…) synthesize mouse events
> from touch input on desktop trackpads and treat them as pointer/mouse
> events rather than touch events. The `Touchpad` device will therefore
> only receive events on actual **touch-screen** hardware. On a laptop
> trackpad, input is handled by the `Mouse` device instead.

## Constructor

### `new Touchpad(options)`

```ts
interface TouchpadOptions {
  canvas: CanvasAdapter;
}

new Touchpad(options: TouchpadOptions);
```

## Types

```ts
const TouchIdentifier = {
  primary: 0,
  secondary: 1,
  tertiary: 2
} as const;

type TouchAction = number | keyof typeof TouchIdentifier;

type TouchPosition = { x: number; y: number };

interface TouchState {
  isDown: boolean;
  wasStarted: boolean;
  wasEnded: boolean;
  position: { x: number; y: number };
}
```

## Events

```ts
type TouchEvents = {
  start: [Touch, TouchPosition];
  move: [Touch, TouchPosition];
  end: [Touch];
};
```

## Properties

```ts
interface Touchpad {
  static readonly MaxTouches: 10;

  // Per-finger state indexed by touch identifier
  touches: TouchState[];
  // Raw down state, written immediately on DOM events
  touchesDown: boolean[];

  readonly wasActive: boolean;
  // Gesture helpers (read-only)
  readonly isOneFingerGesture: boolean;
  readonly isTwoFingerGesture: boolean;
  readonly isThreeFingerGesture: boolean;
}
```

## API

```ts
interface Touchpad {
  // Lifecycle
  connect(): void;
  disconnect(): void;
  reset(): void;
  update(): void;

  // Returns the TouchState for a given finger identifier
  getTouchState(identifier: TouchAction): TouchState;
}
```


# hello-world.md


# Getting Started: Hello World with JollyPixel Engine

## Prerequisites

- Node.js v24 or higher
- [Vite](https://vite.dev/) (for local dev server)
  - [vite-plugin-checker](https://github.com/fi3ework/vite-plugin-checker): provides checks for TypeScript, ESLint, vue-tsc, and Stylelint
  - [vite-plugin-glsl](https://github.com/UstymUkhman/vite-plugin-glsl#readme): import, inline (and minify) GLSL/WGSL shader files
- TypeScript (recommended)
- `@jolly-pixel/engine` and `@jolly-pixel/runtime` packages

## 1. Project Setup

Create a new directory and initialize your project:

```bash
mkdir my-jolly-game
cd my-jolly-game
npm init -y
npm i @jolly-pixel/engine @jolly-pixel/runtime three
npm i -D @types/three typescript vite vite-plugin-checker vite-plugin-glsl
```

Your `package.json` should look like this:

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@jolly-pixel/engine": "^1.0.0",
    "@jolly-pixel/runtime": "^1.0.0",
    "three": "0.182.0"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vite": "^7.3.1",
    "@types/three": "0.182.0",
    "vite-plugin-checker": "0.12.0",
    "vite-plugin-glsl": "1.5.5"
  }
}
```

## 2. Vite Configuration

Create a minimal `vite.config.ts`:

```js
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import glsl from "vite-plugin-glsl";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    checker({
      typescript: true
    }),
    glsl()
  ]
});
```

## 3. HTML Entry Point

Create `index.html` in your project root:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JollyPixel Hello World</title>
  <link rel="stylesheet" href="./main.css">
  <link rel="icon" type="image/x-icon" href="/favicon.ico" />
</head>
<body>
  <canvas tabindex="-1"></canvas>
  <script type="module" src="./src/main.ts"></script>
</body>
</html>
```

## 4. TypeScript Entry Point

Create `src/main.ts`:

```ts
import { Runtime, loadRuntime } from "@jolly-pixel/runtime";

const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
if (!canvas) {
  throw new Error("HTMLCanvasElement not found");
}

const runtime = new Runtime(canvas, {
  includePerformanceStats: true
});

// Add actors, components, and systems via the runtime API, for example:
// runtime.world.addActor(...);

loadRuntime(runtime).catch(console.error);
```

## 5. Run Your Game

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. You should see a blank canvas—your engine is running!

## 6. Next Steps

- Add actors and components to your scene using the engine API.
- Explore our [games](https://github.com/JollyPixel/games) repository for real-world example.
- See the [engine README](../../README.md) and [runtime README](../../../runtime/README.md) for more advanced usage and API details.

---

You now have a working JollyPixel hello world! Continue exploring the docs to build your game.


# adapters.md

# Adapters

Thin interfaces that abstract Browser and Three.js APIs behind
injectable contracts. This enables unit testing with mocks and
decouples engine code from `window`, `document`, `navigator`,
and `canvas` globals.

Each adapter has a matching `Browser*Adapter` class that delegates
to the real browser API and is used as the default implementation.

## EventTarget

Base interface shared by all adapters that need event listeners.

```ts
type EventTargetListener = (...args: any[]) => void | boolean;

interface EventTargetAdapter {
  addEventListener(
    type: string,
    listener: EventTargetListener,
    options?: boolean | AddEventListenerOptions
  ): void;
  removeEventListener(
    type: string,
    listener: EventTargetListener,
    options?: boolean | AddEventListenerOptions
  ): void;
}
```

## Canvas

```ts
interface CanvasAdapter extends EventTargetAdapter {
  requestFullscreen(): void;
  requestPointerLock(options?: PointerLockOptions): Promise<void>;
  focus(options?: FocusOptions): void;
}
```

## Document

```ts
interface DocumentAdapter extends EventTargetAdapter {
  fullscreenElement?: Element | null;
  pointerLockElement?: Element | null;

  exitFullscreen(): void;
  exitPointerLock(): void;
}
```

Default: `BrowserDocumentAdapter` (delegates to `document`).

## Window

```ts
interface WindowAdapter extends EventTargetAdapter {
  onbeforeunload?: ((this: Window, ev: BeforeUnloadEvent) => any) | null;
  navigator: NavigatorAdapter;
}
```

Default: `BrowserWindowAdapter` (delegates to `window`).

## Navigator

```ts
interface NavigatorAdapter {
  getGamepads(): (Gamepad | null)[];
  vibrate(pattern: VibratePattern): boolean;
}
```

Default: `BrowserNavigatorAdapter` (delegates to `navigator`).

## Console

```ts
interface ConsoleAdapter {
  log(message?: any, ...optionalParams: any[]): void;
  warn(message?: any, ...optionalParams: any[]): void;
  error(message?: any, ...optionalParams: any[]): void;
}
```


# audio.md

# Audio Internals

Low-level audio services used internally by `GlobalAudioManager`.
These are not part of the public API but can be injected for testing
or custom implementations.

## AudioListener

Minimal interface wrapping Three.js `AudioListener` master volume.

```ts
type AudioListenerAdapter = {
  getMasterVolume: () => number;
  setMasterVolume: (value: number) => void;
};
```

## AudioBuffer

Buffer loading and caching layer.

```ts
interface AudioBufferLoader {
  load(url: string): Promise<AudioBuffer>;
}

interface AudioBufferCache {
  get(key: string): AudioBuffer | undefined;
  set(key: string, buffer: AudioBuffer): void;
  has(key: string): boolean;
  clear(): void;
}
```

Default implementations:

- `ThreeAudioBufferLoader` — uses `THREE.AudioLoader`
- `InMemoryAudioBufferCache` — in-memory `Map`-based cache

## AudioService

Factory that creates `THREE.Audio` and `THREE.PositionalAudio` instances
with automatic buffer caching.

```ts
interface AudioFactory {
  createAudio(url: string): Promise<THREE.Audio>;
  createPositionalAudio(url: string): Promise<THREE.PositionalAudio>;
}
```

```ts
interface AudioServiceOptions {
  listener?: AudioListenerAdapter;
  cache?: AudioBufferCache;
  loader?: AudioBufferLoader;
}

new AudioService(options: AudioServiceOptions);
```


# fixed-time-step.md

# FixedTimeStep

`FixedTimeStep` decouples the game's **logical update rate** (e.g. physics, simulation) from the display's frame rate. Instead of updating once per rendered frame (which varies with hardware and browser load), it accumulates elapsed time and runs a fixed number of updates at a constant interval. This ensures deterministic, reproducible physics and gameplay regardless of rendering performance.

The implementation guards against the ["doom spiral"](http://blogs.msdn.com/b/shawnhar/archive/2011/03/25/technical-term-that-should-exist-quot-black-pit-of-despair-quot.aspx) — a situation where each tick takes longer than the previous one — by capping accumulated time to at most 5 update intervals.

## Usage

```ts
import { FixedTimeStep } from "@jolly-pixel/engine";

const fixedTimeStep = new FixedTimeStep();
fixedTimeStep.setFps(60); // (render FPS, fixed update FPS)

// Start the timer before your main loop
fixedTimeStep.start();

function loop() {
  fixedTimeStep.tick({
    fixedUpdate: (fixedDelta) => {
      // Run physics or deterministic logic here
      game.fixedUpdate(fixedDelta);
    },
    update: (interpolation, delta) => {
      // Use interpolation for smooth rendering
      game.render(interpolation, delta);
    }
  });

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
```

deterministic time):

## Callbacks

`FixedTimeStep` uses a callback object:

```ts
interface FixedTimeStepCallbacks {
  fixedUpdate: (fixedDelta: number) => void;
  update?: (interpolation: number, delta: number) => void;
}
```

- `fixedUpdate` is called one or more times per frame, using a fixed timestep (in ms). Use this for physics and deterministic logic.
- `update` is called once per frame

### Interpolation

The `interpolation` value passed to `update` allows you to render objects smoothly between physics steps. For example, if your physics runs at 60Hz but your display is 144Hz, you can interpolate between the previous and current physics states:

```ts
const renderedPosition = (1 - interpolation) * previousPosition + interpolation * currentPosition;
```

This makes movement appear smooth, even if the physics steps are less frequent than the rendering frames.

## Configuring the frame rate

The target frame rate defaults to **60 FPS** for both rendering and fixed updates. You can change them with `setFps(renderFps, fixedFps)`. Values are clamped between `1` and `FixedTimeStep.MaxFramesPerSecond` (60):

```ts
fixedTimeStep.setFps(30, 60); // 30 FPS render, 60 FPS fixed update
```

The fixed update interval is derived as `1000 / fixedFramesPerSecond` (in milliseconds).

## Doom spiral protection

If the browser stalls (e.g. tab switch, debugger breakpoint), the accumulated time can grow very large. Without a cap, the engine would try to catch up with dozens of updates in a single frame, making the problem worse.

`FixedTimeStep` limits catch-up to at most **5 intervals**, discarding excess time.


# renderer.md

# Renderer

The `Renderer` interface defines the rendering pipeline used
by [World](world.md). It abstracts over the
underlying graphics API so the rest of the engine only depends on
a small set of operations: resize, draw, and clear.

The engine ships with one concrete implementation —
`ThreeRenderer` — built on top of Three.js's `WebGLRenderer`.

## ThreeRenderer

`ThreeRenderer` is the default renderer. It creates a
`THREE.WebGLRenderer` from a `<canvas>` element and manages
cameras, post-processing, and automatic resizing.

```ts
import { SceneEngine, ThreeRenderer } from "@jolly-pixel/engine";

const canvas = document.querySelector("canvas")!;
const scene = new SceneEngine();

const renderer = new ThreeRenderer(canvas, {
  scene,
  renderMode: "direct"
});
```

```ts
interface ThreeRendererOptions {
  /** The scene whose Three.js scene graph will be rendered. */
  scene: Scene;
  /** Rendering strategy (see below). @default "direct" */
  renderMode?: "direct" | "composer";
}
```

The underlying `THREE.WebGLRenderer` is accessible via
`getSource()`:

```ts
const webGL = renderer.getSource();
webGL.toneMappingExposure = 1.5;
```

## Render modes

The renderer supports two rendering strategies, selectable at
construction time or at runtime with `setRenderMode`:

| Mode | Description |
| ---- | ----------- |
| `"direct"` | Renders the scene directly with `THREE.WebGLRenderer.render()`. Simplest and fastest for scenes without post-processing. |
| `"composer"` | Routes rendering through Three.js `EffectComposer`, enabling multi-pass post-processing effects. |

```ts
renderer.setRenderMode("composer");
```

Switching mode at runtime recreates the internal strategy,
preserves existing render components (cameras), and triggers a
resize.

## Cameras (render components)

Cameras are registered as **render components**. The renderer
iterates over all registered cameras on every draw call:

```ts
import * as THREE from "three";

const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 1000);
renderer.addRenderComponent(camera);
```

When using composer mode, each camera automatically gets its own
`RenderPass` in the effect chain. Removing a camera also removes
its associated pass:

```ts
renderer.removeRenderComponent(camera);
```

On resize, perspective cameras have their `aspect` updated and
orthographic cameras have their frustum recalculated.

## Post-processing effects

In `"composer"` mode, additional passes can be added with
`setEffects`:

```ts
import { UnrealBloomPass } from
  "three/addons/postprocessing/UnrealBloomPass.js";

const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.5, 0.4, 0.85
);
renderer.setEffects(bloom);
```

Effects are only applied when the render mode is `"composer"`;
calling `setEffects` in `"direct"` mode is a no-op.

## Aspect ratio

By default the renderer fills its parent element. An explicit
aspect ratio can be enforced with `setRatio`:

```ts
// Lock to 16:9
renderer.setRatio(16 / 9);

// Reset to fill parent
renderer.setRatio(null);
```

When a ratio is set, the canvas is centered and letter-boxed
within the viewport.

## Resize

`resize()` is called automatically on every draw and whenever the
window fires a resize event (wired up by
[World](world.md)). It updates the renderer size,
the effect composer (if active), and every registered camera's
projection matrix.

The renderer emits a `"resize"` event after each actual size
change:

```ts
renderer.on("resize", ({ width, height }) => {
  console.log(`Canvas resized to ${width}×${height}`);
});
```

## Draw and clear

`draw()` performs a full render frame:

1. Resizes if needed.
2. Clears the frame buffer.
3. Delegates to the active render strategy (direct or composer).
4. Emits the `"draw"` event.

```ts
renderer.onDraw(({ source }) => {
  // source is the THREE.WebGLRenderer
});
```

`clear()` clears the frame buffer without rendering.

## Events

`ThreeRenderer` extends `EventEmitter` and emits:

| Event | Payload | When it fires |
| ----- | ------- | ------------- |
| `resize` | `{ width, height }` | After the canvas size changes |
| `draw` | `{ source }` | After each render frame |

## See also

- [World](world.md) — wires the renderer into the
  game loop
- [SceneManager](scene-manager.md) — the scene graph that is rendered


# scene-manager.md

# Scene

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

## Creating a scene

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

## Actor tree

The scene exposes a root [ActorTree](../actor/actor-tree.md) via
the `tree` property. When an [Actor](../actor/actor.md) is created
without a parent, it is automatically added to this tree. All tree
traversal and lookup features are available from the root:

```ts
const player = scene.tree.getActor("Player");
```

## Lifecycle

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

### Awake

When `awake()` is called (typically once, at connection time), the
scene walks the entire tree and calls `awake()` on every actor
that has not yet been awoken.

It then emits the `"awake"` event.

```ts
scene.on("awake", () => {
  console.log("Scene is ready");
});
```

### beginFrame

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

## Destroying actors

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

## Destroying components

Individual components can be removed without destroying their
actor:

```ts
scene.destroyComponent(component);
```

The component is flagged as `pendingForDestruction` and queued. If
it was still waiting for its `start()` call, it is removed from
the start queue. The actual `destroy()` hook runs at the end of
the current frame's update.

## Events

`SceneEngine` extends `EventEmitter` and emits:

| Event | When it fires |
| ----- | ------------- |
| `awake` | After all actors have been awoken during `scene.awake()` |

## See also

- [Actor](../actor/actor.md) — the engine's core entity
- [ActorComponent](../actor/actor-component.md) — component
  lifecycle and API
- [ActorTree](../actor/actor-tree.md) — tree traversal and lookups


# world.md

# World

The `World` is the central orchestrator of the engine. It
wires together the [SceneManager](scene-manager.md),
[Renderer](renderer.md), [Input](../controls/input.md),
and [Audio](../audio/audio.md) systems and drives the main
**connect → update → render** loop.

Every project creates exactly one `World`. It is passed to
every [Actor](../actor/actor.md) at construction time and is
available throughout the component tree via `actor.world`.

## Creating a game instance

```ts
import {
  SceneEngine,
  ThreeRenderer,
  World
} from "@jolly-pixel/engine";

const canvas = document.querySelector("canvas")!;
const sceneManager = new SceneManager();
const renderer = new ThreeRenderer(canvas, { sceneManager });

const game = new World(renderer, { sceneManager });
```

The constructor accepts a [Renderer](renderer.md) and a
`WorldOptions` object:

```ts
interface WorldOptions {
  /** The scene that manages actors and components. */
  sceneManager: SceneContract;
  /** Input system for keyboard, mouse, gamepad, etc. @default auto-created from canvas */
  input?: Input;
  /** Global audio manager. @default new GlobalAudio() */
  audio?: GlobalAudio;
  /** Enable the exit mechanism on the input system. @default false */
  enableOnExit?: boolean;
  /** Abstraction over `window` (useful for testing). @default BrowserWindowAdapter */
  windowAdapter?: WindowAdapter;
  /** Abstraction over global references (useful for testing). @default BrowserGlobalsAdapter */
  globalsAdapter?: GlobalsAdapter;
}
```

## Loading manager

Three.js assets (models, textures, audio) can share a single
`THREE.LoadingManager` via the game instance:

```ts
const manager = new THREE.LoadingManager();
manager.onProgress = (_url, loaded, total) => {
  console.log(`${loaded}/${total}`);
};

game.setLoadingManager(manager);
```

The loading manager is available from anywhere as
`actor.world.loadingManager`.

## Connect and disconnect

`connect()` starts the game by wiring up input listeners, the
window resize handler, and awakening the scene:

```ts
game.connect();
```

Internally this:

1. Connects the [Input](../controls/input.md) system.
2. Registers the renderer's `resize` callback on the window
   adapter.
3. Calls `scene.awake()`, which awakens all existing actors and
   emits the `"awake"` event.

`disconnect()` tears down the listeners:

```ts
game.disconnect();
```

## Game loop

The game loop is driven by a
[FixedTimeStep](../internals/fixed-time-step.md) which separates
deterministic logic from rendering:

```ts
const fixedTimeStep = new FixedTimeStep();
fixedTimeStep.start();

function loop() {
  game.beginFrame();
  fixedTimeStep.tick({
    fixedUpdate: (fixedDelta) => {
      game.fixedUpdate(fixedDelta / 1000);
    },
    update: (_interpolation, delta) => {
      game.update(delta / 1000);
      game.render();
    }
  });
  const exited = game.endFrame();
  if (exited) { /* stop loop */ }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
```

#### `beginFrame()`

Called once at the start of each animation frame:

1. Updates the [Input](../controls/input.md) system.
2. Calls `sceneManager.beginFrame()` — snapshots the actor tree
   and starts pending components. The snapshot is reused by all
   `fixedUpdate` and `update` calls within the same frame.

#### `fixedUpdate(deltaTime)`

Runs deterministic logic at a fixed rate (0 to N times per frame):

1. Calls `sceneManager.fixedUpdate(deltaTime)` — runs
   `actor.fixedUpdate(deltaTime)` on each cached actor.

### `update(deltaTime)`

Runs variable-rate logic once per rendered frame:

1. Calls `sceneManager.update(deltaTime)` — runs
   `actor.update(deltaTime)` on each cached actor.

#### `endFrame(): boolean`

Called once at the end of each animation frame:

1. Calls `sceneManager.endFrame()` — destroys pending components
   and actors.
2. If the input system signals an exit, clears the renderer and
   returns `true`. Otherwise returns `false`.

### `render()`

Delegates to `renderer.draw()`, which resizes if needed, clears
the frame buffer, and renders the scene through all active
cameras.

## Accessing subsystems

All subsystems are available as public properties, making them
accessible from any actor or component:

```ts
// From inside a Behavior
const { input, sceneManager, audio, renderer } = this.actor.world;

if (input.isKeyDown("Space")) {
  audio.play("jump");
}
```

## See also

- [SceneManager](scene-manager.md) — actor tree, lifecycle, and destruction
- [Renderer](renderer.md) — rendering pipeline
- [Input](../controls/input.md) — input handling
- [Actor](../actor/actor.md) — the engine's core entity


# ui-node.md

# UINode

A **UINode** is an [ActorComponent](../actor/actor-component.md)
that positions an actor in screen space using an **anchor**,
**offset**, and **pivot** system. It is the base positioning layer
for all 2D UI elements — [UISprite](./ui-sprite.md) extends it to
add visuals and interaction.

When a [UIRenderer](./ui-renderer.md) exists in the game instance,
every new `UINode` automatically registers itself with the renderer.
Otherwise it falls back to listening to renderer `resize` events
directly.

```ts
import { Actor, UINode } from "@jolly-pixel/engine";

const hud = new Actor(world, {
  name: "hud",
  parent: camera2D
})
  .addComponent(UINode, {
    anchor: { x: "right", y: "top" },
    offset: { x: -16, y: -16 },
    size: { width: 100, height: 40 }
  });
```

## Anchor

The **anchor** determines which screen edge the element aligns to.
Anchors are independent on each axis.

| Axis | Values | Description |
| ---- | ------ | ----------- |
| `x` | `"left"`, `"center"`, `"right"` | Horizontal screen edge |
| `y` | `"top"`, `"center"`, `"bottom"` | Vertical screen edge |

When an anchor is set to `"left"`, the element is pushed against the
left edge of the screen. Combined with an offset you can create
consistent margins that survive window resizes.

## Offset

The **offset** shifts the element away from its anchor in
world units. Positive X moves right, positive Y moves up.

```ts
// 20 units from the left edge, 10 units below the top
{
  anchor: { x: "left", y: "top" },
  offset: { x: 20, y: -10 }
}
```

## Pivot

The **pivot** is a normalized origin point from `0` to `1` that
controls which part of the element sits at the computed position.

| Pivot | Meaning |
| ----- | ------- |
| `{ x: 0, y: 0 }` | Bottom-left corner |
| `{ x: 0.5, y: 0.5 }` | Center (default) |
| `{ x: 1, y: 1 }` | Top-right corner |

Setting the pivot to `{ x: 0, y: 1 }` makes the top-left corner
the origin — useful for left-aligned HUD panels anchored to the
top of the screen.

## Size

The **size** defines the width and height of the element in world
units. It is used by `UISprite` to create the mesh geometry and by
the anchoring logic to keep the element fully on-screen.

```ts
{
  size: { width: 200, height: 60 }
}
```

## Constructor

```ts
interface UINodeOptions {
  anchor?: {
    x?: "left" | "center" | "right";
    y?: "top" | "center" | "bottom";
  };
  offset?: {
    x?: number;
    y?: number;
  };
  size?: {
    width?: number;
    height?: number;
  };
  pivot?: {
    x?: number;
    y?: number;
  };
}
```

| Option | Default | Description |
| ------ | ------- | ----------- |
| `anchor` | `{ x: "center", y: "center" }` | Screen-edge alignment |
| `offset` | `{ x: 0, y: 0 }` | Offset from the anchor in world units |
| `size` | `{ width: 0, height: 0 }` | Element dimensions in world units |
| `pivot` | `{ x: 0.5, y: 0.5 }` | Normalized origin point (0 – 1) |

## Positioning examples

**Centered element:**

```ts
// Defaults — centered on screen
{ anchor: { x: "center", y: "center" } }
```

**Top-right corner with margin:**

```ts
{
  anchor: { x: "right", y: "top" },
  offset: { x: -16, y: -16 },
  pivot: { x: 1, y: 1 }
}
```

**Bottom-left health bar:**

```ts
{
  anchor: { x: "left", y: "bottom" },
  offset: { x: 20, y: 20 },
  size: { width: 300, height: 24 },
  pivot: { x: 0, y: 0 }
}
```

## API

```ts
class UINode extends ActorComponent {
  get size(): { width: number; height: number };
  get pivot(): { x: number; y: number };

  addChildren(object: THREE.Object3D): void;
  updateToWorldPosition(): void;
}
```

## See also

- [UIRenderer](./ui-renderer.md) — the orthographic overlay system
- [UISprite](./ui-sprite.md) — visual + interactive UI element
- [ActorComponent](../actor/actor-component.md) — component base type


# ui-renderer.md

# UIRenderer

The **UIRenderer** is an [ActorComponent](../actor/actor-component.md)
that provides an orthographic 2D overlay on top of the 3D scene.
It creates its own `OrthographicCamera` and a Three.js
`CSS2DRenderer` so that [UINode](./ui-node.md) and
[UISprite](./ui-sprite.md) elements are always drawn screen-aligned,
independently from the main 3D camera.

Typically a single `UIRenderer` is registered once on a dedicated
actor (e.g. `"camera2D"`). Every `UINode` created under that actor
auto-discovers the renderer and registers itself.

```ts
import { Actor, UIRenderer, UISprite } from "@jolly-pixel/engine";

const camera2D = new Actor(world, { name: "camera2D" })
  .addComponent(UIRenderer, { near: 1 });
```

## How it works

1. On construction the component creates an `OrthographicCamera`
   sized to match the current canvas and appends a `CSS2DRenderer`
   DOM element on top of the WebGL canvas.
2. It listens to the game renderer's `resize` event and
   automatically updates both the CSS overlay size and every
   registered node position.
3. On every `draw` event it renders the scene through the
   orthographic camera so that CSS2D objects (used by
   [UIText](./ui-sprite.md)) stay in sync with the 3D world.

## Constructor

```ts
interface UIRendererOptions {
  /** Near clipping plane of the orthographic camera. */
  near?: number;
  /** Far clipping plane of the orthographic camera. */
  far?: number;
  /** Z position of the camera (draw order). */
  zIndex?: number;
}
```

| Option | Default | Description |
| ------ | ------- | ----------- |
| `near` | `0.1` | Near clipping plane |
| `far` | `2000` | Far clipping plane |
| `zIndex` | `10` | Camera Z position — controls draw order |

## Creating a HUD element

Once a `UIRenderer` exists, child actors can register
[UISprite](./ui-sprite.md) components that are automatically
positioned relative to the screen edges.

```ts
const button = new Actor(world, {
  name: "startButton",
  parent: camera2D
})
  .addComponentAndGet(UISprite, {
    anchor: { x: "center", y: "top" },
    offset: { y: -80 },
    size: { width: 200, height: 60 },
    style: { color: 0x0077ff },
    styleOnHover: { color: 0x0099ff },
    text: {
      textContent: "Start",
      style: {
        color: "#ffffff",
        fontSize: "20px",
        fontWeight: "bold"
      }
    }
  });

button.onClick.connect(() => {
  console.log("Start clicked!");
});
```

## Updating positions at runtime

When you change the offset or anchor of a node after creation
you can force a full re-layout by calling `updateWorldPosition`:

```ts
const uiRenderer = camera2D.getComponent(UIRenderer)!;
uiRenderer.updateWorldPosition();
```

## Cleanup

Calling `clear()` destroys every registered node, removes the
CSS overlay from the DOM, and unsubscribes from renderer events:

```ts
uiRenderer.clear();
```

## API

```ts
class UIRenderer extends ActorComponent {
  static ID: symbol;
  camera: THREE.OrthographicCamera;
  nodes: UINode[];

  addChildren(node: UINode): void;
  updateWorldPosition(): void;
  clear(): void;
}
```

## See also

- [UINode](./ui-node.md) — base positioning component
- [UISprite](./ui-sprite.md) — interactive sprite with events
- [ActorComponent](../actor/actor-component.md) — component base type
- [Renderers](../components/renderers.md) — 3D renderer components


# ui-sprite.md

# UISprite

A **UISprite** is a [UINode](./ui-node.md) that renders a flat
rectangular mesh and provides pointer interaction signals. It is
the main building block for buttons, panels, icons, and other
interactive 2D elements drawn by the
[UIRenderer](./ui-renderer.md).

```ts
import { Actor, UISprite } from "@jolly-pixel/engine";

const btn = new Actor(world, {
  name: "playButton",
  parent: camera2D
})
  .addComponentAndGet(UISprite, {
    anchor: { x: "center", y: "center" },
    size: { width: 180, height: 50 },
    style: { color: 0x0077ff },
    text: { textContent: "Play" }
  });

btn.onClick.connect(() => console.log("Clicked!"));
```

## Style

The `style` option controls the default appearance of the sprite's
`MeshBasicMaterial`. An optional `styleOnHover` is automatically
swapped in when the pointer enters the element and reverted when
it leaves.

```ts
interface UISpriteStyle {
  color?: THREE.ColorRepresentation;
  map?: THREE.Texture;
  opacity?: number;
}
```

| Property | Default | Description |
| -------- | ------- | ----------- |
| `color` | `0xffffff` | Fill color of the material |
| `map` | `null` | Texture applied to the mesh |
| `opacity` | `1` | Transparency (0 fully transparent – 1 opaque) |

```ts
.addComponentAndGet(UISprite, {
  size: { width: 64, height: 64 },
  style: {
    map: myTexture,
    opacity: 0.9
  },
  styleOnHover: {
    color: 0xaaddff
  }
});
```

## Text

Passing a `text` option embeds a **UIText** label rendered with the
CSS2DRenderer on top of the sprite mesh. The text is a regular HTML
`<div>` styled via CSS properties.

```ts
interface UITextOptions {
  textContent?: string;
  style?: UITextStyle;
  /** Z offset in front of the sprite mesh. */
  zOffset?: number;
}
```

| Property | Default | Description |
| -------- | ------- | ----------- |
| `textContent` | `""` | Initial text content |
| `style` | see below | CSS style properties |
| `zOffset` | `0.1` | Z distance in front of the mesh |

Default text style:

```ts
{
  color: "#ffffff",
  fontSize: "14px",
  fontFamily: "Arial, sans-serif",
  whiteSpace: "nowrap"
}
```

All standard CSS text properties are supported: `color`,
`fontSize`, `fontFamily`, `fontWeight`, `textAlign`, `lineHeight`,
`letterSpacing`, `textTransform`, `textShadow`, `padding`,
`backgroundColor`, `borderRadius`, `opacity`, and `whiteSpace`.

## Signals

`UISprite` exposes [SignalEvent](../components/signal.md) instances
for every pointer interaction. Subscribe with `connect` and
unsubscribe with `disconnect`.

| Signal | Fires when |
| ------ | ---------- |
| `onPointerEnter` | Pointer first enters the sprite bounds |
| `onPointerLeave` | Pointer leaves the sprite bounds |
| `onPointerDown` | Left mouse button pressed over the sprite |
| `onPointerUp` | Left mouse button released (was pressed over sprite) |
| `onClick` | Full click — down and up while still over the sprite |
| `onDoubleClick` | Two clicks within 300 ms |
| `onRightClick` | Right mouse button released over the sprite |
| `onHover` | Same as `onPointerEnter` (convenience alias) |

```ts
const sprite = actor.addComponentAndGet(UISprite, {
  size: { width: 100, height: 40 },
  style: { color: 0x333333 }
});

sprite.onClick.connect(() => console.log("clicked"));
sprite.onDoubleClick.connect(() => console.log("double click"));
sprite.onPointerEnter.connect(() => console.log("enter"));
sprite.onPointerLeave.connect(() => console.log("leave"));
sprite.onRightClick.connect(() => console.log("right click"));
```

## Hover styling

When `styleOnHover` is provided the material is updated
automatically on pointer enter and restored on pointer leave.
No manual signal wiring is needed.

```ts
.addComponentAndGet(UISprite, {
  size: { width: 120, height: 40 },
  style: { color: 0x222222, opacity: 0.8 },
  styleOnHover: { color: 0x4444ff, opacity: 1 }
});
```

## Hit testing

`UISprite` performs hit testing every frame in its `update` loop
by projecting the mouse world position onto the mesh bounding box.
The `isPointerOver()` method is available if you need to query the
hover state manually:

```ts
if (sprite.isPointerOver()) {
  // pointer is currently over this sprite
}
```

## Constructor

```ts
interface UISpriteOptions extends UINodeOptions {
  style?: UISpriteStyle;
  styleOnHover?: UISpriteStyle;
  text?: UITextOptions;
}
```

| Option | Default | Description |
| ------ | ------- | ----------- |
| `style` | `{}` | Default material style |
| `styleOnHover` | `null` | Style applied on pointer hover |
| `text` | — | Optional text label overlay |

All [UINode options](./ui-node.md) (`anchor`, `offset`, `size`,
`pivot`) are also accepted.

## API

```ts
class UISprite extends UINode {
  mesh: THREE.Mesh;

  onPointerEnter: SignalEvent;
  onPointerLeave: SignalEvent;
  onPointerDown: SignalEvent;
  onPointerUp: SignalEvent;
  onClick: SignalEvent;
  onDoubleClick: SignalEvent;
  onRightClick: SignalEvent;
  onHover: SignalEvent;

  isPointerOver(): boolean;
  destroy(): void;
}
```

## See also

- [UINode](./ui-node.md) — base positioning component
- [UIRenderer](./ui-renderer.md) — the orthographic overlay system
- [Signal](../components/signal.md) — event system used by signals
- [Renderers](../components/renderers.md) — 3D renderer components


