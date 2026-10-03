// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { AssetKindRegistry } from "../kinds/AssetKindRegistry.ts";
import type { Logger } from "../logger.ts";
import type { AssetPayload } from "./AssetWriteInput.ts";
import { asError } from "../utils/asError.ts";

export interface DependencyReaderOptions {
  kinds: AssetKindRegistry;
  logger: Logger;
}

export class DependencyReader {
  #kinds: AssetKindRegistry;
  #logger: Logger;

  constructor(
    options: DependencyReaderOptions
  ) {
    this.#kinds = options.kinds;
    this.#logger = options.logger;
  }

  resolve(
    assetId: string,
    kind: string,
    payload: AssetPayload
  ): AssetReferenceData[] {
    const references = payload.dependencies ??
      this.#handlerDependencies(assetId, kind, payload.data);

    return uniqueDependencies(assetId, references);
  }

  #handlerDependencies(
    assetId: string,
    kind: string,
    data: Uint8Array
  ): readonly AssetReferenceData[] {
    const handler = this.#kinds.get(kind);
    if (handler.dependencies === undefined) {
      return [];
    }

    const decoded = this.#kinds.decode(kind, assetId, data);
    if (!decoded.ok) {
      return this.#skip(assetId, kind, decoded.val);
    }

    try {
      return handler.dependencies(decoded.val.state);
    }
    catch (error) {
      return this.#skip(assetId, kind, asError(error));
    }
  }

  #skip(
    assetId: string,
    kind: string,
    error: Error
  ): readonly AssetReferenceData[] {
    this.#logger
      .withMetadata({
        assetId,
        kind,
        reason: error.message
      })
      .warn("asset dependencies not computed");

    return [];
  }
}

function uniqueDependencies(
  assetId: string,
  references: readonly AssetReferenceData[]
): AssetReferenceData[] {
  const unique = new Map<string, AssetReferenceData>();
  for (const reference of references) {
    if (
      reference.id !== assetId &&
      !unique.has(reference.id)
    ) {
      unique.set(reference.id, reference);
    }
  }

  return [...unique.values()];
}
