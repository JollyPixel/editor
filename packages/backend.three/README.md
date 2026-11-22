<p align="center">
  <img src="./docs/banner.png" alt="JollyPixel">
</p>

## 📌 About

The three.js backend of `@jolly-pixel/ecs`. It draws the world with a `THREE.WebGPURenderer` and adds the renderers, cameras, lights, audio, in-game UI, asset loaders and the browser `Runtime` that boots a game on a canvas.

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/ecs @jolly-pixel/backend.three three
# or
$ yarn add @jolly-pixel/ecs @jolly-pixel/backend.three three
```

`three` is a peer dependency. Start with the [Hello World guide](./docs/guides/hello-world.md).

## 👀 Usage example

The runtime needs a `<canvas>` element to render into.

Start by creating an **HTML** file with a canvas and an ECMAScript `module` script entry point:

```html
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Game</title>
  <link rel="stylesheet" href="./main.css">
  <link rel="icon" type="image/x-icon" href="/favicon.ico" />
</head>

<canvas tabindex="-1"></canvas>

<script type="module" src="./src/main.ts"></script>

</html>
```

> [!TIP]
> The `tabindex="-1"` attribute on the canvas allows it to receive keyboard focus, which is required for capturing input events.

Then in your main script, create and load a `Runtime`. `load()` detects the
GPU, loads the startup assets and the initial scene, then starts the world and
game loop:

```ts
import { Runtime } from "@jolly-pixel/backend.three";

const runtime = await Runtime.create("canvas", {
  includePerformanceStats: true,
  focusCanvas: true,
  assets: {
    catalog: new URL("assets.json", document.baseURI)
  }
});

runtime.load({
  scene: new GameScene()
}).catch(console.error);
```

Vite serves `public/assets.json` during development and copies it to the build
output. `Runtime.create()` fetches and parses the catalog before it constructs
the world. Resolving it from `document.baseURI` works on both platforms below.

## 🖥️ Platforms

The web and desktop builds share the same HTML file and application code. Only
the build setup differs.

- [Web](./docs/guides/platforms/web.md): serve and build the application with
  Vite.
- [Desktop](./docs/guides/platforms/desktop.md): a relative Vite base and an
  Electron main process that loads `dist/index.html`.

## 🔎 Guides

- [Hello World](./docs/guides/hello-world.md): a new project from scratch.
- [Scenes and assets](./docs/guides/scenes-and-assets.md): the catalog, the
  initial scene, scene changes, and explicit load batches.
- [Loading screen](./docs/guides/loading-screen.md): container, minimum delay,
  theming, or starting without a screen.
- [Custom asset loaders](./docs/guides/custom-asset-loaders.md): register a
  loader for a project-specific asset kind.
- [Frame scheduling and performance](./docs/guides/frame-scheduling-and-performance.md):
  loop and device settings, performance statistics, metrics, and renderer
  counters.

## 📚 API

### 🚀 Runtime

- [Runtime](./docs/runtime/Runtime.md) — construction, renderer, view helper
  and what the three.js runtime adds to `RuntimeCore`.
  - [Runtime asset options](./docs/runtime/runtime-assets.md) — catalogs,
    platform loaders and `ThreeComponentPackage`.
  - [RendererMetrics](./docs/runtime/RendererMetrics.md) — renderer counters
    and GPU time.

### ⚙️ Systems

- [ThreeRenderer](./docs/systems/renderer.md) — the `Renderer` port on a
  `THREE.WebGPURenderer`: configuration, post-processing, cameras, compiles.
  - [BakedRoomEnvironment](./docs/systems/baked-room-environment.md) — prefiltered `RoomEnvironment` reflection map, loaded instead of generated at runtime.
- [ThreeSceneGraph](./docs/systems/scene-graph.md) — the scene graph port on a
  `THREE.Scene`, and `ThreeSceneEnvironment`.
- [Assets](./docs/assets.md) — built-in asset types and loaders: models,
  fonts, sounds, textures, scene and environment files, shaders.

### 🧩 Components

- [Renderers](./docs/components/renderers.md) — sprites, models, text and meshes.
- [Camera](./docs/components/camera.md)
  - [Camera Controls](./docs/components/camera-3d-controls.md)
  - [Orbit Fly Camera](./docs/components/orbit-fly-camera.md)
- [Light](./docs/components/light.md)
- [Audio components](./docs/components/audio.md) — `AudioSource`,
  `AudioListener` and `AudioZone`.
- [Scene file definitions](./docs/components/definitions.md) — how a
  `FileScene` builds these components.

<details>
<summary>Code Example</summary>

```ts
import { Actor } from "@jolly-pixel/ecs";
import { ModelRenderer } from "@jolly-pixel/backend.three";

new Actor(world, { name: "player" })
  .addComponent(ModelRenderer, { asset: PlayerModel })
  .addComponent(PlayerBehavior, { speed: 0.5 });
```

</details>

### 🔊 Audio

Manages sound playback. It provides a global volume controller, a factory for creating audio sources, and a playlist-based background music manager.

- [Audio](./docs/audio/audio.md) — plays sounds through a mixer of
  categories, with voice limits, fades and positional sound.
  - [AudioBackground](./docs/audio/audio-background.md) —
    playlist-based background music with sequential track playback,
    pause/resume/stop, and playlist chaining.

<details>
<summary>Code Example</summary>

```ts
import { AudioBackground } from "@jolly-pixel/backend.three";

const bg = new AudioBackground({
  audio: world.audio,
  autoPlay: true,
  playlists: [{
    name: "main",
    onEnd: "loop",
    tracks: [
      { name: "theme", sound: themeSound }
    ]
  }]
});

world.audio.volume = 0.5;
world.audio.mixer.category("sfx").muted = true;
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

### 🧰 Utils

- [disposeObject3D](./docs/utils/dispose-object-3d.md) — releases the GPU
  resources owned by an Object3D subtree.

## 🧪 Benchmarks

`ThreeSceneGraph` runs the ECS actor lifecycle and `Transform` rows again,
where each actor owns an `Object3D`. `CameraCompositor#render` draws one
fullscreen camera, then three cameras with viewports, on a stub renderer.

```bash
pnpm --filter @jolly-pixel/backend.three bench -- --allocations
```

## Contributors guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

`pnpm run dev` serves the `examples/` pages. Once you have finished your development, check that the tests (and linter) are still good by running the following script:

```bash
$ pnpm run test
$ pnpm run lint
```

> [!CAUTION]
> In case you introduce a new feature or fix a bug, make sure to include tests for it as well.

## License

MIT

<!-- Reference-style links for DRYness -->

[electron]: https://www.electronjs.org/
[npm]: https://docs.npmjs.com/getting-started/what-is-npm
[yarn]: https://yarnpkg.com
[contributing]: ../../CONTRIBUTING.md
