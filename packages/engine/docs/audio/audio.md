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

Master volume controller. Wraps a Three.js `AudioListener` and emits
`volumechange` when the volume changes. Every sound created with the
world listener goes through the listener gain, so the master volume
applies to it without any extra wiring.

```ts
type GlobalAudioEvents = {
  volumechange: [volume: number];
};
```

```ts
interface GlobalAudio {
  readonly listener: THREE.AudioListener;
  /** Same object as `listener`. */
  readonly threeAudioListener: THREE.AudioListener;

  /** Master volume, clamped to [0, 1]. */
  volume: number;
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

  // Sync — construct from a buffer already prepared by the runtime
  createAudio(buffer: AudioBuffer, options?: AudioLoadingOptions): THREE.Audio;
  createPositionalAudio(buffer: AudioBuffer, options?: AudioLoadingOptions): THREE.PositionalAudio;

  destroyAudio(audio: THREE.Audio | THREE.PositionalAudio): void;
}
```

### Construction

```ts
interface GlobalAudioManagerOptions {
  /** @default new THREE.AudioListener() */
  listener?: THREE.AudioListener;
  /** @default THREE.AudioLoader */
  loadBuffer?: (url: string) => Promise<AudioBuffer>;
}

GlobalAudioManager.fromWorld(world: World): GlobalAudioManager;
```

`fromWorld` binds the manager to the world's `AudioListener`, so the
world master volume applies to every sound it creates. A manager built
with its own listener is independent from `world.audio.volume`.
`volume` in `AudioLoadingOptions` is the per-sound gain.

The browser runtime registers `AudioAssetLoader` (exported with
`AUDIO_ASSET`) by default.

### Async loading (`loadAudio` / `loadPositionalAudio`)

Fetches and decodes a URL on demand. Useful for audio that is loaded
dynamically at runtime (e.g. user-triggered sound effects loaded after the
loading screen). Each URL is decoded once per manager; a failed load is
retried on the next call.

```ts
const audio = await audioManager.loadAudio("sounds/click.mp3", { volume: 0.5 });
audio.play();
```

### Sync creation from pre-loaded buffers (`createAudio` / `createPositionalAudio`)

When buffers have been prepared through the runtime (e.g. via
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
