// Import Third-party Dependencies
import {
  AssetPath,
  type AssetReferenceData
} from "@jolly-pixel/asset";
import {
  writableAssetPath,
  type AssetSource
} from "@jolly-pixel/asset-source";
import {
  Err,
  Ok,
  type Result
} from "@openally/result";
import { asError } from "@jolly-pixel/utils";

// Import Internal Dependencies
import type {
  AnyAssetKindHandler,
  ConvertedCompanion
} from "../../model/kinds/AssetKindHandler.ts";
import type { AssetKindRegistry } from "../../model/kinds/AssetKindRegistry.ts";
import { UnknownAssetKindError } from "../../model/kinds/errors/UnknownAssetKindError.ts";
import { serializeAsset } from "../../model/kinds/serializeAsset.ts";
import type { AssetPathAllocator } from "./AssetPathAllocator.ts";
import type {
  AssetPayload,
  CreateAssetInput
} from "./AssetWriteInput.ts";

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
  source: AssetSource;
  kinds: AssetKindRegistry;
  paths: AssetPathAllocator;
}

interface CompanionSource {
  readonly kind: string;

  state(
    handler: AnyAssetKindHandler,
    assetId: string
  ): Result<unknown, Error>;

  link(
    owner: unknown,
    companion: AssetReferenceData
  ): void;
}

interface CreationRecipe {
  readonly companions: readonly CompanionSource[];

  owner(
    assetId: string
  ): Result<unknown, Error>;
}

interface PlannedCompanion {
  source: CompanionSource;
  handler: AnyAssetKindHandler;
  extension: string;
}

interface AllocatedAsset {
  assetId: string;
  path: AssetPath;
}

export class AssetCreationPlanner {
  #source: AssetSource;
  #kinds: AssetKindRegistry;
  #paths: AssetPathAllocator;

  constructor(
    options: AssetCreationPlannerOptions
  ) {
    this.#source = options.source;
    this.#kinds = options.kinds;
    this.#paths = options.paths;
  }

  async plan(
    input: CreateAssetInput
  ): Promise<Result<AssetCreationPlan, Error>> {
    const writable = writableAssetPath(this.#source, input.path);
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

    const content = input.converted?.content ?? input.data;
    const companions = input.converted?.companions ?? [];
    try {
      if (content !== undefined && companions.length === 0) {
        return this.#adopt(handler, requested, input, content);
      }

      const recipe = content === undefined ?
        Ok(scaffoldRecipe(handler)) :
        conversionRecipe(handler, this.#kinds, content, companions);
      if (!recipe.ok) {
        return recipe;
      }

      return await this.#build(handler, requested, input, recipe.val);
    }
    catch (error) {
      return Err(asError(error));
    }
  }

  #adopt(
    handler: AnyAssetKindHandler,
    requested: AssetPath,
    input: CreateAssetInput,
    data: Uint8Array
  ): Result<AssetCreationPlan, Error> {
    return this.#allocate(requested, [], input).map(({ assetId, path }) => {
      return {
        owner: {
          assetId,
          path: path.toString(),
          kind: handler.kind,
          data,
          dependencies: input.dependencies,
          parts: input.parts
        },
        companions: []
      };
    });
  }

  async #build(
    handler: AnyAssetKindHandler,
    requested: AssetPath,
    input: CreateAssetInput,
    recipe: CreationRecipe
  ): Promise<Result<AssetCreationPlan, Error>> {
    const companions = this.#planCompanions(
      handler,
      requested.extension,
      recipe.companions
    );
    if (!companions.ok) {
      return companions;
    }

    const allocated = this.#allocate(requested, companions.val, input);
    if (!allocated.ok) {
      return allocated;
    }

    const { assetId, path } = allocated.val;
    const owner = recipe.owner(assetId);
    if (!owner.ok) {
      return owner;
    }

    const planned: PlannedAsset[] = [];
    for (const { source, handler: companionHandler, extension } of companions.val) {
      const companionPath = path.withExtension(extension).toString();
      const companionId = this.#paths.dormantId(companionPath) ??
        crypto.randomUUID();
      const state = source.state(companionHandler, companionId);
      if (!state.ok) {
        return state;
      }

      source.link(owner.val, {
        id: companionId,
        kind: companionHandler.kind
      });
      planned.push({
        assetId: companionId,
        path: companionPath,
        kind: companionHandler.kind,
        ...await serializeAsset(companionHandler, state.val)
      });
    }

    return Ok({
      owner: {
        assetId,
        path: path.toString(),
        kind: handler.kind,
        ...await serializeAsset(handler, owner.val)
      },
      companions: planned
    });
  }

  #allocate(
    requested: AssetPath,
    siblings: readonly PlannedCompanion[],
    input: CreateAssetInput
  ): Result<AllocatedAsset, Error> {
    const allocated = this.#paths.allocate({
      path: requested,
      siblingExtensions: siblings.map(({ extension }) => extension),
      assetId: input.assetId,
      onPathConflict: input.onPathConflict
    });

    return allocated.map((path) => {
      return {
        assetId: input.assetId ??
          this.#paths.dormantId(path.toString()) ??
          crypto.randomUUID(),
        path
      };
    });
  }

  #planCompanions(
    owner: AnyAssetKindHandler,
    extension: string,
    sources: readonly CompanionSource[]
  ): Result<PlannedCompanion[], Error> {
    const extensions = new Set([extension]);
    const companions: PlannedCompanion[] = [];
    for (const source of sources) {
      if (!this.#kinds.has(source.kind)) {
        const error = new UnknownAssetKindError(source.kind);

        return Err(error);
      }

      const handler = this.#kinds.get(source.kind);
      const [companionExtension] = Object.keys(handler.extensions);
      if (
        companionExtension === undefined ||
        extensions.has(companionExtension)
      ) {
        const error = new TypeError(
          `Asset kind "${owner.kind}" lists companion kind ` +
          `"${source.kind}" without a distinct extension.`
        );

        return Err(error);
      }

      extensions.add(companionExtension);
      companions.push({
        source,
        handler,
        extension: companionExtension
      });
    }

    return Ok(companions);
  }
}

function scaffoldRecipe(
  handler: AnyAssetKindHandler
): CreationRecipe {
  return {
    owner: (assetId) => Ok(handler.create(assetId)),
    companions: (handler.companions ?? []).map((companion) => {
      return {
        kind: companion.kind,
        state: (companionHandler, assetId) => Ok(companionHandler.create(assetId)),
        link: (owner, reference) => companion.link(owner, reference)
      };
    })
  };
}

function conversionRecipe(
  handler: AnyAssetKindHandler,
  kinds: AssetKindRegistry,
  content: Uint8Array,
  companions: readonly ConvertedCompanion[]
): Result<CreationRecipe, Error> {
  const rebind = handler.rebind?.bind(handler);
  if (rebind === undefined) {
    const error = new TypeError(
      `Asset kind "${handler.kind}" takes converted companions ` +
      "without a rebind to link them."
    );

    return Err(error);
  }

  return Ok({
    owner: (assetId) => kinds
      .decode(handler.kind, assetId, content)
      .map(({ state }) => state),
    companions: companions.map((companion) => {
      return {
        kind: companion.kind,
        state: (companionHandler, assetId) => kinds
          .decode(companionHandler.kind, assetId, companion.content)
          .map(({ state }) => state),
        link: (owner, reference) => rebind(
          owner,
          new Map([[companion.id, reference.id]])
        )
      };
    })
  });
}
