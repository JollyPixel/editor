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

const sfx = new AudioLibrary();
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
interface AudioLibrary {
  // Enqueue `path` in AssetManager and store it under `name`.
  // Must be called before AssetManager.loadAssets().
  register(name: string, path: string): LazyAsset<AudioBuffer>;

  // Return the loaded AudioBuffer for `name`.
  // Throws if the name was never registered or loadAssets has not completed.
  get(name: string): AudioBuffer;
}
```

> [!NOTE]
> `register` enqueues the file for loading but does not fetch it immediately.
> The buffer is only available after `Assets.loadAssets()` resolves.

## See also

- [Asset Loading](../asset.md)
- [Audio](audio.md)
