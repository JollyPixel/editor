<p align="center">
  <img src="./docs/banner.png" alt="JollyPixel">
</p>

## 📌 About

Minimal and opinionated [ECS][ecs] inspired by [Superpowers][superpowers] and [Craftstudio][craftstudio]. It holds actors, components, behaviors, scenes, scene files and transforms, and imports no renderer: a backend such as `@jolly-pixel/backend.three` draws the world.

> [!WARNING]
> The ECS is still in a heavy phase of development (expect frequent API breaking changes).

## 💡 Features

- [ECS][ecs] architecture with Actors, Components, and Scenes
- Godot-like [Signals][signals]
- Behavior scripts with decorator-driven scene properties
- Scene files, prefabs and environments as plain JSON
- Input controls (mouse, keyboard, gamepads, touchpad)
- A headless backend that runs a world without a GPU

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/ecs
# or
$ yarn add @jolly-pixel/ecs
```

## 🧱 Backends

ECS talks to a renderer through two ports, the [Renderer](./docs/systems/renderer.md) and the [Scene graph](./docs/systems/scene-graph.md). `@jolly-pixel/backend.three` implements them with three.js and adds the renderers, cameras, lights, audio, UI and the browser `Runtime`. A headless backend (`HeadlessRenderer`, `HeadlessSceneGraph`) runs a world without a GPU.

The public API takes plain `Vector3Like`, `QuaternionLike` and `EulerLike` objects, so any `{ x, y, z }` object works, including a three.js `Vector3`.

## 📚 API

### ⚙️ Systems

Systems drive the game loop and manage shared resources such as assets. They operate on actors and their components each frame.

- [World](./docs/systems/world.md) — top-level orchestrator that ties the renderer, scene,
  input, and audio into a unified game loop.
  - [Renderer](./docs/systems/renderer.md) — the drawing port and the `HeadlessRenderer`.
  - [SceneManager](./docs/systems/scene-manager.md) — owns the actor tree and drives
    per-frame lifecycle (awake → start → update → destroy).
    - [Scene graph](./docs/systems/scene-graph.md) — the backend port that mirrors actors into a renderer scene.
    - [Scene files](./docs/systems/scene-file.md) — scenes, prefabs and anchors as JSON, built by `FileScene`.
    - [Environment](./docs/systems/environment.md) — the sky, lights, fog and tone mapping a scene renders in, with built-in presets.
    - [Component packages](./docs/systems/component-package.md) — the component definitions and asset loaders a package gives a game.
  - [Logger](./docs/systems/logger.md): leveled, namespaced logging and timed steps.
- [Assets](./docs/asset.md) — scene asset declarations and synchronous reads.

<details>
<summary>Code Example</summary>

```ts
import { Systems } from "@jolly-pixel/ecs";

const sceneManager = new Systems.SceneManager(new Systems.HeadlessSceneGraph());
const game = new Systems.World(new Systems.HeadlessRenderer(canvas), {
  enableOnExit: true,
  sceneManager,
  assetCoordinator
});

game.connect();
```

</details>

### 🎭 Actor

An Actor is a named node in the scene tree that holds a Transform, a list of Components, and a
dictionary of Behaviors. ECS uses the name *Actor* (inspired by [Superpowers][superpowers]) instead of the traditional *Entity* term.

- [Actor](./docs/actor/actor.md) — the entity itself, holding its
  transform, components, and behaviors.
  - [Transform](./docs/actor/actor-transform.md) — the actor's pose, pushed to
    its scene graph node, with a complete local/global transform API
    (position, orientation, scale, movement).
  - [ActorTree](./docs/actor/actor-tree.md) — tree structure that
  manages parent-child actor relationships and provides pattern-based
  lookups.

<details>
<summary>Code Example</summary>

```ts
const player = world.createActor("Player");
player.transform.local.position = { x: 0, y: 1, z: 0 };

const child = world.createActor("Weapon", {
  parent: player
});

player.destroy();
```

</details>

#### 🧩 Components

Components are data and logic units attached to an Actor.

- [ActorComponent](./docs/actor/actor-component.md) — the base class all components extend.
  - [Signals](./docs/components/signal.md) — lightweight pub/sub event emitter for actor-level communication (Godot-inspired signals).
- [Behavior](./docs/components/behavior.md) — script components with a property system and decorator-driven initialization.

<details>
<summary>Code Example</summary>

```ts
import { Behavior, Actor, SignalEvent } from "@jolly-pixel/ecs";

export interface PlayerBehaviorOptions {
  speed?: number;
}

class PlayerBehavior extends Behavior {
  readonly moved = new SignalEvent();
  speed = 0.1;

  constructor(
    actor: Actor, options: PlayerBehaviorOptions = {}
  ) {
    super(actor);
    this.speed = options?.speed ?? 0.1;
  }

  update() {
    if (this.actor.world.input.keyboard.isDown("ArrowUp")) {
      this.moved.emit();
      this.actor.transform.moveForward(this.speed);
    }
  }
}

new Actor(world, { name: "player" })
  .addComponent(PlayerBehavior, { speed: 0.5 });
```

</details>

### 🎮 Device Controls

ECS re-exports `Input`, `InputCombination`, `Axis` and `AxisMap` from `@jolly-pixel/controls`.

> [!TIP]
> In ActorComponent or Behavior input are accessible through this.actor.world.input

## 🧪 Benchmarks

The suites measure `World#tick()` over static and updating actors, actor
churn and `findComponent`, `ActorTree` lookups and `Transform` moves. They run
on a world with no-op renderer and input on a `HeadlessSceneGraph`, so the
numbers leave out any backend and the GPU.

```bash
pnpm --filter @jolly-pixel/ecs bench -- --allocations
```

Filtering and measurement rules are documented by `@jolly-pixel/bench`.

## Contributors guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Once you have finished your development, check that the tests (and linter) are still good by running the following script:

```bash
$ pnpm run test
$ pnpm run lint
```

> [!CAUTION]
> In case you introduce a new feature or fix a bug, make sure to include tests for it as well.

### 📦 Internals

- [Adapters](./docs/internals/adapters.md)

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
