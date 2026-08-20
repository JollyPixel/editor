// Import Third-party Dependencies
import picomatch from "picomatch";

// Import Internal Dependencies
import type { AssetKindHandler } from "./AssetKindHandler.ts";
import {
  binaryAssetHandler,
  BINARY_KIND
} from "./binary.ts";
import { UnknownAssetKindError } from "../errors/UnknownAssetKindError.ts";

interface RegisteredKind {
  handler: AssetKindHandler;
  isMatch: picomatch.Matcher;
}

/**
 * Resolves handlers in registration order, then falls back to `binary`.
 */
export class AssetKindRegistry {
  #kinds = new Map<string, RegisteredKind>();

  constructor(
    handlers: Iterable<AssetKindHandler> = []
  ) {
    for (const handler of handlers) {
      this.register(handler);
    }
  }

  register(
    handler: AssetKindHandler
  ): this {
    if (handler.kind === BINARY_KIND) {
      throw new TypeError(
        `"${BINARY_KIND}" is the built-in fallback kind and cannot be replaced.`
      );
    }
    if (this.#kinds.has(handler.kind)) {
      throw new TypeError(
        `Asset kind "${handler.kind}" is already registered.`
      );
    }

    this.#kinds.set(handler.kind, {
      handler,
      isMatch: picomatch([...handler.match], { dot: true })
    });

    return this;
  }

  has(
    kind: string
  ): boolean {
    return kind === BINARY_KIND || this.#kinds.has(kind);
  }

  get(
    kind: string
  ): AssetKindHandler {
    if (kind === BINARY_KIND) {
      return binaryAssetHandler;
    }

    const registered = this.#kinds.get(kind);
    if (registered === undefined) {
      throw new UnknownAssetKindError(kind);
    }

    return registered.handler;
  }

  /**
   * First registered handler claiming the path, else the binary fallback.
   */
  resolve(
    path: string
  ): AssetKindHandler {
    for (const { handler, isMatch } of this.#kinds.values()) {
      if (isMatch(path)) {
        return handler;
      }
    }

    return binaryAssetHandler;
  }

  kinds(): IterableIterator<string> {
    return this.#kinds.keys();
  }
}
