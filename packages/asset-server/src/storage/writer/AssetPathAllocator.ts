// Import Third-party Dependencies
import { AssetPath } from "@jolly-pixel/asset";
import {
  Err,
  Ok,
  type Result
} from "@openally/result";
import {
  AssetPathEscapeError,
  isStatePath,
  safeAssetPath
} from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import { AssetPathConflictError } from "./errors/AssetPathConflictError.ts";
import type { AssetIndex } from "../AssetIndex.ts";
import type { AssetProjector } from "../projection/AssetProjector.ts";
import type { PathConflictPolicy } from "../../model/PathConflictPolicy.ts";

export interface AssetPathAllocatorOptions {
  projector: AssetProjector;
  assetIndex: AssetIndex;
}

export interface AssetPathRequest {
  path: AssetPath;
  siblingExtensions: readonly string[];
  assetId?: string;
  onPathConflict?: PathConflictPolicy;
}

export class AssetPathAllocator {
  #projector: AssetProjector;
  #assetIndex: AssetIndex;

  constructor(
    options: AssetPathAllocatorOptions
  ) {
    this.#projector = options.projector;
    this.#assetIndex = options.assetIndex;
  }

  allocate(
    request: AssetPathRequest
  ): Result<AssetPath, AssetPathConflictError> {
    const { path, siblingExtensions, assetId } = request;

    let candidate = path;
    let vacant = this.#vacantGroup(candidate, siblingExtensions, assetId);
    for (
      let index = 2;
      !vacant.ok && request.onPathConflict === "suffix";
      index++
    ) {
      candidate = path.withName(`${path.name}-${index}`);
      vacant = this.#vacantGroup(candidate, siblingExtensions, assetId);
    }

    return vacant.map(() => candidate);
  }

  vacant(
    path: string,
    assetId: string | undefined
  ): Result<void, AssetPathConflictError> {
    const occupant = this.#projector.assetAt(path);
    if (occupant === null || occupant === assetId) {
      return Ok(undefined);
    }

    const error = new AssetPathConflictError(path, occupant);

    return Err(error);
  }

  dormantId(
    path: string
  ): string | undefined {
    const recorded = this.#assetIndex.byPath(path)?.id;
    if (
      recorded === undefined ||
      this.#projector.desired(recorded) !== null
    ) {
      return undefined;
    }

    return recorded;
  }

  #vacantGroup(
    path: AssetPath,
    siblingExtensions: readonly string[],
    assetId: string | undefined
  ): Result<void, AssetPathConflictError> {
    const owner = this.vacant(path.toString(), assetId);
    if (!owner.ok) {
      return owner;
    }

    for (const extension of siblingExtensions) {
      const sibling = this.vacant(
        path.withExtension(extension).toString(),
        undefined
      );
      if (!sibling.ok) {
        return sibling;
      }
    }

    return Ok(undefined);
  }
}

export function writableAssetPath(
  input: string
): Result<string, AssetPathEscapeError> {
  const result = safeAssetPath(input);
  if (!result.ok) {
    const error = new AssetPathEscapeError(input, result.val);

    return Err(error);
  }
  if (isStatePath(result.val)) {
    const error = new AssetPathEscapeError(input, "reserved");

    return Err(error);
  }

  return Ok(result.val);
}
