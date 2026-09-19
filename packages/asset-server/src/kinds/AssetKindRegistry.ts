// Import Third-party Dependencies
import picomatch from "picomatch";

// Import Internal Dependencies
import type { AssetKindHandler } from "./AssetKindHandler.ts";
import {
  binaryAssetKind,
  BINARY_KIND
} from "./handlers/binary.ts";
import { UnknownAssetKindError } from "./errors/UnknownAssetKindError.ts";

interface RegisteredKind {
  handler: AssetKindHandler;
  extensions: readonly string[];
  isMatch: picomatch.Matcher | null;
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

    const extensions = Object.keys(handler.extensions);
    if (extensions.length === 0) {
      throw new TypeError(
        `Asset kind "${handler.kind}" declares no extensions.`
      );
    }
    const invalid = extensions.find(
      (extension) => !extension.startsWith(".") || extension.length < 2
    );
    if (invalid !== undefined) {
      throw new TypeError(
        `Asset kind "${handler.kind}" declares an invalid extension "${invalid}".`
      );
    }

    this.#kinds.set(handler.kind, {
      handler,
      extensions,
      isMatch: handler.match === undefined ?
        null :
        picomatch([...handler.match], { dot: true })
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
      return binaryAssetKind;
    }

    const registered = this.#kinds.get(kind);
    if (registered === undefined) {
      throw new UnknownAssetKindError(kind);
    }

    return registered.handler;
  }

  resolve(
    path: string
  ): AssetKindHandler {
    for (const { handler, extensions, isMatch } of this.#kinds.values()) {
      if (
        extensions.some((extension) => path.endsWith(extension)) &&
        (isMatch === null || isMatch(path))
      ) {
        return handler;
      }
    }

    return binaryAssetKind;
  }

  kinds(): IterableIterator<string> {
    return this.#kinds.keys();
  }

  contentTypes(): Record<string, string> {
    const table: Record<string, string> = {};
    for (const { handler } of this.#kinds.values()) {
      Object.assign(table, handler.extensions);
    }

    return table;
  }
}
