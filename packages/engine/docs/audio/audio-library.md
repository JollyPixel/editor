# AudioLibrary

`AudioLibrary` gives gameplay code named, synchronous access to sounds that
the runtime prepared before an ECS lifecycle method runs.

## Setup

References use stable catalog IDs and `SoundAssetType`:

```ts
import {
  AssetId,
  AssetReference
} from "@jolly-pixel/asset";
import {
  AudioLibrary,
  SoundAssetType
} from "@jolly-pixel/engine";

const ShootAudio = new AssetReference(
  new AssetId("audio.shoot"),
  SoundAssetType
);

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
  shoot() {
    this.actor.world.audio.play(sfx.get("shoot"), { volume: 0.8 });
  }
}
```

## API

```ts
class AudioLibrary<TKeys extends string = string> {
  constructor(assetCoordinator: AssetCoordinator);

  register(
    name: TKeys,
    reference: AssetReference<Sound>
  ): AssetHandle<Sound>;

  get(name: TKeys): Sound;
}
```

`get()` throws when a name was not registered or its handle is not ready.

## See also

- [Assets in the engine](../asset.md)
- [Audio](audio.md)
