// Import Third-party Dependencies
import type {
  AssetCoordinator,
  AssetHandle,
  AssetReference
} from "@jolly-pixel/asset";

/**
 * Maps gameplay names to synchronously readable audio asset handles.
 */
export class AudioLibrary<
  TKeys extends string = string
> {
  #assetCoordinator: AssetCoordinator;
  #assets = new Map<TKeys, AssetHandle<AudioBuffer>>();

  constructor(
    assetCoordinator: AssetCoordinator
  ) {
    this.#assetCoordinator = assetCoordinator;
  }

  register(
    name: TKeys,
    reference: AssetReference<AudioBuffer>
  ): AssetHandle<AudioBuffer> {
    const handle = this.#assetCoordinator.request(
      reference
    );
    this.#assets.set(name, handle);

    return handle;
  }

  get(
    name: TKeys
  ): AudioBuffer {
    const handle = this.#assets.get(name);
    if (!handle) {
      throw new Error(`Audio "${name}" not registered.`);
    }

    return handle.get();
  }
}
