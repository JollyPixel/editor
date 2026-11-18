// Import Third-party Dependencies
import type {
  AssetCoordinator,
  AssetHandle,
  AssetReference
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { Sound } from "./Sound.ts";

export class AudioLibrary<
  TKeys extends string = string
> {
  #assetCoordinator: AssetCoordinator;
  #assets = new Map<TKeys, AssetHandle<Sound>>();

  constructor(
    assetCoordinator: AssetCoordinator
  ) {
    this.#assetCoordinator = assetCoordinator;
  }

  register(
    name: TKeys,
    reference: AssetReference<Sound>
  ): AssetHandle<Sound> {
    const handle = this.#assetCoordinator.request(
      reference
    );
    this.#assets.set(name, handle);

    return handle;
  }

  get(
    name: TKeys
  ): Sound {
    const handle = this.#assets.get(name);
    if (!handle) {
      throw new Error(`Audio "${name}" not registered.`);
    }

    return handle.get();
  }
}
