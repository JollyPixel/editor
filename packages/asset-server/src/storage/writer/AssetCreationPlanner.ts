// Import Third-party Dependencies
import { AssetPath } from "@jolly-pixel/asset";
import {
  Err,
  Ok,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import type {
  AssetKindCompanion,
  AnyAssetKindHandler
} from "../../model/kinds/AssetKindHandler.ts";
import type { AssetKindRegistry } from "../../model/kinds/AssetKindRegistry.ts";
import { UnknownAssetKindError } from "../../model/kinds/errors/UnknownAssetKindError.ts";
import {
  writableAssetPath,
  type AssetPathAllocator
} from "./AssetPathAllocator.ts";
import type {
  AssetPayload,
  CreateAssetInput
} from "./AssetWriteInput.ts";
import { asError } from "../../common/asError.ts";

export interface PlannedAsset extends AssetPayload {
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
  handler: AnyAssetKindHandler;
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
      const error = new UnknownAssetKindError(input.kind);

      return Err(error);
    }

    const requested = new AssetPath(writable.val);
    const handler = input.kind === undefined ?
      this.#kinds.resolve(writable.val) :
      this.#kinds.get(input.kind);
    const companions = input.data === undefined ?
      this.#planCompanions(handler, requested.extension) :
      Ok([]);
    if (!companions.ok) {
      return companions;
    }

    const allocated = this.#paths.allocate({
      path: requested,
      siblingExtensions: companions.val.map(({ extension }) => extension),
      assetId: input.assetId,
      onPathConflict: input.onPathConflict
    });
    if (!allocated.ok) {
      return allocated;
    }

    const path = allocated.val.toString();
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
          allocated.val,
          companions.val
        )
      );
    }
    catch (error) {
      return Err(asError(error));
    }
  }

  async #scaffold(
    handler: AnyAssetKindHandler,
    assetId: string,
    path: AssetPath,
    companions: readonly PlannedCompanion[]
  ): Promise<AssetCreationPlan> {
    const state = handler.create(assetId);
    const planned: PlannedAsset[] = [];
    for (const { companion, handler: companionHandler, extension } of companions) {
      const companionPath = path.withExtension(extension).toString();
      const companionId = this.#paths.dormantId(companionPath) ??
        crypto.randomUUID();

      companion.link(state, {
        id: companionId,
        kind: companionHandler.kind
      });
      planned.push({
        assetId: companionId,
        path: companionPath,
        kind: companionHandler.kind,
        data: await companionHandler.serialize(
          companionHandler.create(companionId)
        )
      });
    }

    return {
      owner: {
        assetId,
        path: path.toString(),
        kind: handler.kind,
        data: await handler.serialize(state)
      },
      companions: planned
    };
  }

  #planCompanions(
    handler: AnyAssetKindHandler,
    extension: string
  ): Result<PlannedCompanion[], Error> {
    const extensions = new Set([extension]);
    const companions: PlannedCompanion[] = [];
    for (const companion of handler.companions ?? []) {
      if (!this.#kinds.has(companion.kind)) {
        const error = new UnknownAssetKindError(companion.kind);

        return Err(error);
      }

      const companionHandler = this.#kinds.get(companion.kind);
      const [companionExtension] = Object.keys(companionHandler.extensions);
      if (
        companionExtension === undefined ||
        extensions.has(companionExtension)
      ) {
        const error = new TypeError(
          `Asset kind "${handler.kind}" lists companion kind ` +
          `"${companion.kind}" without a distinct extension.`
        );

        return Err(error);
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
