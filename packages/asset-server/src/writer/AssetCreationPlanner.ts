// Import Third-party Dependencies
import { AssetSource as AssetSourcePath } from "@jolly-pixel/asset";
import {
  Err,
  Ok,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import type {
  AssetKindCompanion,
  AssetKindHandler
} from "../kinds/AssetKindHandler.ts";
import type { AssetKindRegistry } from "../kinds/AssetKindRegistry.ts";
import { UnknownAssetKindError } from "../kinds/errors/UnknownAssetKindError.ts";
import {
  siblingPath,
  writableAssetPath,
  type AssetPathAllocator
} from "./AssetPathAllocator.ts";
import type { CreateAssetInput } from "./AssetWriter.ts";
import type { AssetContent } from "./DependencyReader.ts";
import { asError } from "../utils/asError.ts";

export interface PlannedAsset extends AssetContent {
  assetId: string;
  path: string;
  kind: string;
}

export interface AssetCreationPlan {
  owner: PlannedAsset;
  companions: PlannedAsset[];
}

export interface AssetCreationPlannerOptions {
  kinds: AssetKindRegistry;
  paths: AssetPathAllocator;
}

interface PlannedCompanion {
  companion: AssetKindCompanion;
  handler: AssetKindHandler;
  extension: string;
}

export class AssetCreationPlanner {
  #kinds: AssetKindRegistry;
  #paths: AssetPathAllocator;

  constructor(
    options: AssetCreationPlannerOptions
  ) {
    this.#kinds = options.kinds;
    this.#paths = options.paths;
  }

  async plan(
    input: CreateAssetInput
  ): Promise<Result<AssetCreationPlan, Error>> {
    const writable = writableAssetPath(input.path);
    if (!writable.ok) {
      return Err(writable.val);
    }

    if (input.kind !== undefined && !this.#kinds.has(input.kind)) {
      return Err(new UnknownAssetKindError(input.kind));
    }

    const requested = new AssetSourcePath(writable.val);
    const handler = input.kind === undefined ?
      this.#kinds.resolve(writable.val) :
      this.#kinds.get(input.kind);
    const companions = input.data === undefined ?
      this.#companionsOf(handler, requested.extension) :
      Ok([]);
    if (!companions.ok) {
      return companions;
    }

    const source = this.#paths.allocate({
      source: requested,
      siblingExtensions: companions.val.map(({ extension }) => extension),
      assetId: input.assetId,
      onPathConflict: input.onPathConflict
    });
    if (!source.ok) {
      return source;
    }

    const path = source.val.toString();
    const assetId = input.assetId ??
      this.#paths.dormantId(path) ??
      crypto.randomUUID();
    if (input.data !== undefined) {
      return Ok({
        owner: {
          assetId,
          path,
          kind: handler.kind,
          data: input.data,
          dependencies: input.dependencies
        },
        companions: []
      });
    }

    try {
      return Ok(
        await this.#scaffold(
          handler,
          assetId,
          source.val,
          companions.val
        )
      );
    }
    catch (error) {
      return Err(asError(error));
    }
  }

  async #scaffold(
    handler: AssetKindHandler,
    assetId: string,
    source: AssetSourcePath,
    companions: readonly PlannedCompanion[]
  ): Promise<AssetCreationPlan> {
    const state = handler.create(assetId);
    const planned: PlannedAsset[] = [];
    for (const { companion, handler: companionHandler, extension } of companions) {
      const path = siblingPath(source, extension);
      const companionId = this.#paths.dormantId(path) ?? crypto.randomUUID();

      companion.link(state, {
        id: companionId,
        kind: companionHandler.kind
      });
      planned.push({
        assetId: companionId,
        path,
        kind: companionHandler.kind,
        data: await companionHandler.serialize(
          companionHandler.create(companionId)
        )
      });
    }

    return {
      owner: {
        assetId,
        path: source.toString(),
        kind: handler.kind,
        data: await handler.serialize(state)
      },
      companions: planned
    };
  }

  #companionsOf(
    handler: AssetKindHandler,
    extension: string
  ): Result<PlannedCompanion[], Error> {
    const extensions = new Set([extension]);
    const companions: PlannedCompanion[] = [];
    for (const companion of handler.companions ?? []) {
      if (!this.#kinds.has(companion.kind)) {
        return Err(new UnknownAssetKindError(companion.kind));
      }

      const companionHandler = this.#kinds.get(companion.kind);
      const [companionExtension] = Object.keys(companionHandler.extensions);
      if (
        companionExtension === undefined ||
        extensions.has(companionExtension)
      ) {
        return Err(new TypeError(
          `Asset kind "${handler.kind}" lists companion kind ` +
          `"${companion.kind}" without a distinct extension.`
        ));
      }

      extensions.add(companionExtension);
      companions.push({
        companion,
        handler: companionHandler,
        extension: companionExtension
      });
    }

    return Ok(companions);
  }
}
