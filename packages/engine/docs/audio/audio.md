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
Internally caches `AudioBuffer` instances to avoid redundant fetches.

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
  loadAudio(url: string, options?: AudioLoadingOptions): Promise<THREE.Audio>;
  loadPositionalAudio(url: string, options?: AudioLoadingOptions): Promise<THREE.PositionalAudio>;
  destroyAudio(audio: THREE.Audio | THREE.PositionalAudio): void;
}

// Create from a World
GlobalAudioManager.fromWorld(world: World): GlobalAudioManager;
``` 

## See also

- [AudioBackground](audio-background.md)
