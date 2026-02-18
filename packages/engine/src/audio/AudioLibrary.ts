// Import Internal Dependencies
import { Assets } from "../systems/index.ts";
import type { LazyAsset } from "../systems/asset/Base.ts";

export class AudioLibrary<
  TKeys extends string = string
> {
  #assets = new Map<TKeys, LazyAsset<AudioBuffer>>();

  register(
    name: TKeys,
    path: string
  ): LazyAsset<AudioBuffer> {
    const lazy = Assets.load<AudioBuffer>(path);
    this.#assets.set(name, lazy);

    return lazy;
  }

  get(
    name: TKeys
  ): AudioBuffer {
    const lazy = this.#assets.get(name);
    if (!lazy) {
      throw new Error(`Audio "${name}" not registered.`);
    }

    return lazy.get();
  }
}
