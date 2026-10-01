// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { AssetKindRegistry } from "../kinds/AssetKindRegistry.ts";
import type { Logger } from "../logger.ts";
import { asError } from "../utils/asError.ts";

export interface AssetContent {
  data: Uint8Array;
  /**
   * Assets `data` references.
   * @default computed by the kind handler from `data`
   */
  dependencies?: readonly AssetReferenceData[];
}

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
    content: AssetContent
  ): AssetReferenceData[] {
    const references = content.dependencies ??
      this.#handlerDependencies(assetId, kind, content.data);

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

    try {
      const state = handler.create(assetId);
      handler.load(state, data);

      return handler.dependencies(state);
    }
    catch (error) {
      this.#logger
        .withMetadata({
          assetId,
          kind,
          reason: asError(error).message
        })
        .warn("asset dependencies not computed");

      return [];
    }
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
