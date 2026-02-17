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
