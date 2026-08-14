# AudioLibrary

`AudioLibrary` gives gameplay code named, synchronous access to audio buffers
that the runtime prepared before an ECS lifecycle method runs.

## Setup

References use stable catalog IDs and `AUDIO_ASSET`:

```ts
import {
  AssetId,
  AssetReference
} from "@jolly-pixel/asset";
import {
  AUDIO_ASSET,
  AudioLibrary,
  GlobalAudioManager
} from "@jolly-pixel/engine";

const ShootAudio = new AssetReference(
  new AssetId("audio.shoot"),
  AUDIO_ASSET
);

const audioManager = GlobalAudioManager.fromWorld(world);
const sfx = new AudioLibrary<"shoot">(
  world.assetCoordinator
);
sfx.register("shoot", ShootAudio);
```

Add the same reference to the owning scene's `assets` list. Runtime will load
and decode it before the scene is activated.

## Synchronous use

```ts
class PlayerBehavior extends Behavior {
  #shootAudio: THREE.Audio;

  start() {
    this.#shootAudio = audioManager.createAudio(
      sfx.get("shoot"),
      { volume: 0.8 }
    );
  }
}
```

## API

```ts
class AudioLibrary<TKeys extends string = string> {
  constructor(assetCoordinator: AssetCoordinator);

  register(
    name: TKeys,
    reference: AssetReference<AudioBuffer>
  ): AssetHandle<AudioBuffer>;

  get(name: TKeys): AudioBuffer;
}
```

`get()` throws when a name was not registered or its handle is not ready.

## See also

- [Assets in the engine](../asset.md)
- [Audio](audio.md)
