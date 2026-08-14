// Import Internal Dependencies
import type { AssetLoader } from "./AssetLoader.ts";
import type { AssetType } from "../AssetType.ts";
import {
  AssetLoaderAlreadyExistsError
} from "../errors/AssetLoaderAlreadyExistsError.ts";
import {
  AssetLoaderNotFoundError
} from "../errors/AssetLoaderNotFoundError.ts";
import { AssetTypeMismatchError } from "../errors/AssetTypeMismatchError.ts";

interface AssetLoaderEntry {
  readonly type: AssetType<unknown>;
  readonly loader: AssetLoader<unknown>;
}

/**
 * Maps each persistent asset kind to its runtime loader.
 */
export class AssetLoaderRegistry {
  #loaders = new Map<string, AssetLoaderEntry>();

  get size(): number {
    return this.#loaders.size;
  }

  register<TValue>(
    type: AssetType<TValue>,
    loader: AssetLoader<TValue>
  ): this {
    if (this.#loaders.has(type.kind)) {
      throw new AssetLoaderAlreadyExistsError(
        type.kind
      );
    }

    this.#loaders.set(
      type.kind,
      {
        type,
        loader
      }
    );

    return this;
  }

  has(
    type: AssetType<unknown>
  ): boolean {
    return this.#loaders.get(type.kind)?.type === type;
  }

  get<TValue>(
    type: AssetType<TValue>
  ): AssetLoader<TValue> {
    const entry = this.#loaders.get(type.kind);
    if (entry === undefined) {
      throw new AssetLoaderNotFoundError(type.kind);
    }
    if (entry.type !== type) {
      throw new AssetTypeMismatchError(type.kind);
    }

    // Token identity recovers TValue after heterogeneous map storage.
    return entry.loader as AssetLoader<TValue>;
  }
}
