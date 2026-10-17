// Import Third-party Dependencies
import picomatch from "picomatch";
import {
  Err,
  Ok,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import type { AssetKindHandler } from "./AssetKindHandler.ts";
import {
  binaryAssetKind,
  BINARY_KIND
} from "./handlers/binary.ts";
import { UnknownAssetKindError } from "./errors/UnknownAssetKindError.ts";
import { UnsupportedAssetConversionError } from "./errors/UnsupportedAssetConversionError.ts";
import { asError } from "../utils/asError.ts";

interface RegisteredKind {
  handler: AssetKindHandler;
  extensions: readonly string[];
  isMatch: picomatch.Matcher | null;
}

export interface DecodedAsset {
  readonly handler: AssetKindHandler;
  readonly state: unknown;
}

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
    const invalid = [
      ...extensions,
      ...Object.keys(handler.conversions ?? {})
    ].find((extension) => !isExtension(extension));
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

  decode(
    kind: string,
    assetId: string,
    content: Uint8Array
  ): Result<DecodedAsset, Error> {
    if (!this.has(kind)) {
      const error = new UnknownAssetKindError(kind);

      return Err(error);
    }

    const handler = this.get(kind);
    try {
      const state = handler.create(assetId);
      handler.load(state, content);

      return Ok({
        handler,
        state
      });
    }
    catch (error) {
      return Err(asError(error));
    }
  }

  async convert(
    kind: string,
    from: string,
    content: Uint8Array
  ): Promise<Result<Uint8Array, Error>> {
    if (!this.has(kind)) {
      const error = new UnknownAssetKindError(kind);

      return Err(error);
    }

    const conversions = this.get(kind).conversions ?? {};
    const conversion = Object.hasOwn(conversions, from) ?
      conversions[from] :
      undefined;
    if (conversion === undefined) {
      const error = new UnsupportedAssetConversionError(kind, from);

      return Err(error);
    }

    try {
      return Ok(await conversion(content));
    }
    catch (error) {
      return Err(asError(error));
    }
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

function isExtension(
  extension: string
): boolean {
  return extension.startsWith(".") && extension.length >= 2;
}
