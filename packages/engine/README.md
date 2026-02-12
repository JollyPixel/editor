<p align="center"><h1 align="center">
  engine
</h1>

<p align="center">
  JollyPixel Three.js engine
</p>

## 📌 About

Minimal and opinionated [ECS](https://en.wikipedia.org/wiki/Entity_component_system) built on top of Three.js.

> [!NOTE]
> JollyPixel is heavily inspired by [Superpowers](https://github.com/superpowers) for the naming (such as Actor instead of Entity).

## 💡 Features

- Actor/Component architecture with scene tree
- Godot-like [Signals](https://docs.godotengine.org/en/stable/getting_started/step_by_step/signals.html) for Actors and Components
- Behavior scripts
- Input controls (mouse, keyboard, gamepads, touchpad)
- Built-in renderers (3D models, 3D text, sprites, …)
- Asset management
- Audio (background music, sound library, spatial audio)

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm](https://docs.npmjs.com/getting-started/what-is-npm) or [yarn](https://yarnpkg.com).

```bash
$ npm i @jolly-pixel/engine
# or
$ yarn add @jolly-pixel/engine
```

## 📚 API

### ⚙️ Systems

Systems are responsible for driving the game loop, orchestrating rendering, and managing shared
resources such as assets. They operate on actors and their components
each frame.

- [GameInstance](./docs/systems/game-instance.md) — top-level orchestrator that ties the renderer, scene,
  input, and audio into a unified game loop.
  - [GameRenderer](./docs/systems/game-renderer.md) — abstracts the Three.js render pipeline and supports
    direct and post-processing render strategies.
  - [Scene](./docs/systems/scene.md) — the ECS world manager that owns the actor tree and drives
    per-frame lifecycle (awake → start → update → destroy).
- [Asset](./docs/asset.md) — lazy-loading asset pipeline with a
  registry of loaders, a queue, and a cache.

```ts
import { Systems, Actor } from "@jolly-pixel/engine";

const scene = new Systems.SceneEngine();
const renderer = new Systems.ThreeRenderer(canvas, {
  scene,
  renderMode: "direct"
});
const game = new Systems.GameInstance(renderer, {
  enableOnExit: true,
  scene
});

game.connect();
```

> [!TIP]
> [@jolly-pixel/runtime](../runtime/README.md) manage most of that for you

### 🎭 Actor

An Actor is a named node in the scene tree that holds a Transform, a list of Components, and a
dictionary of Behaviors. The engine uses the name *Actor* (inspired by
[Superpowers](https://github.com/superpowers)) instead of the
traditional *Entity* term.

- [ActorTree](./docs/actor/actor-tree.md) — tree structure that
  manages parent-child actor relationships and provides pattern-based
  lookups.
- [Actor](./docs/actor/actor.md) — the entity itself, holding its
  transform, components, and behaviors.
  - [Transform](./docs/actor/actor-transform.md) — built-in component
    wrapping a Three.js Object3D and exposing a complete local/global
    transform API (position, orientation, scale, movement).

```ts
const player = new Actor(gameInstance, { name: "player" });
player.transform.setLocalPosition(0, 1, 0);

const child = new Actor(gameInstance, {
  name: "weapon",
  parent: player
});
```

### 🧩 Components

Components are pure data and logic units attached to an Actor. They come in three flavours:

- [ActorComponent](./docs/actor/actor-component.md) — the base class all components extend (behaviors and renderers are ActorComponent).
- [Renderers](./docs/components/renderers.md) — visual components (sprites, models, text, tiled maps) that know how to draw themselves.
  - [Camera Controls](./docs/components/camera-3d-controls.md)
- [Behavior](./docs/components/behavior.md) — script components with a property system and decorator-driven initialization.
  - [Signals](./docs/components/signal.md) — lightweight pub/sub event emitter for actor-level communication (Godot-inspired signals).

```ts
import {
  Behavior, ModelRenderer, Input,
  Signal, SceneProperty, type SignalEvent
} from "@jolly-pixel/engine";

class PlayerBehavior extends Behavior {
  @Signal()
  onHit: SignalEvent;

  @SceneProperty({ type: "number" })
  speed = 0.05;

  @Input.listen("keyboard.down")
  onKeyDown() {
    console.log("key pressed");
  }

  update() {
    if (this.actor.gameInstance.input.isKeyDown("ArrowUp")) {
      this.actor.transform.moveForward(this.speed);
    }
  }
}

new Actor(gameInstance, { name: "player" })
  .registerComponent(ModelRenderer, { path: "models/Player.glb" })
  .registerComponent(PlayerBehavior);
```

### 🎮 Device Controls

Aggregates all physical devices (mouse, keyboard, gamepads, touchpad, screen) behind a unified
query API so that behaviors can react to player actions without
coupling to a specific device.

- [Input](./docs/controls/input.md) — central input manager
  - [Mouse](./docs/controls/mouse.md)
  - [Keyboard](./docs/controls/keyboard.md)
  - [Gamepad](./docs/controls/gamepad.md)
  - [Touchpad](./docs/controls/touchpad.md)
  - [Screen](./docs/controls/screen.md)
- [CombinedInput](./docs/controls/combinedinput.md) — composable input conditions (AND, OR, NOT, sequence)
  for complex key bindings.

```ts
import { InputCombination } from "@jolly-pixel/engine";

const { input } = gameInstance;

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

### 🔊 Audio

Manages sound playback across the engine. It provides a global volume controller, a factory for creating audio sources, and a playlist-based background music manager.

- [Audio](./docs/audio/audio.md) — global audio controller owning the
  AudioContext and master volume.
  - [AudioBackground](./docs/audio/audio-background.md) —
    playlist-based background music with sequential track playback,
    pause/resume/stop, and playlist chaining.

```ts
import { GlobalAudioManager, AudioBackground } from "@jolly-pixel/engine";

const audioManager = GlobalAudioManager.fromGameInstance(gameInstance);
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

gameInstance.audio.observe(bg);
gameInstance.audio.volume = 0.5;
```

### 🔨 Internals

- [Adapters](./docs/internals/adapters.md)
- [Audio](./docs/internals/audio.md)
- [FixedTimeStep](./docs/internals/fixed-time-step.md)

## License

MIT
