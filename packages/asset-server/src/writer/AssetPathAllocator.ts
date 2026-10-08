// Import Third-party Dependencies
import { AssetSource as AssetSourcePath } from "@jolly-pixel/asset";
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
import type { IdentitySidecar } from "../identity/IdentitySidecar.ts";
import type { AssetProjector } from "../projection/AssetProjector.ts";

// CONSTANTS
export const PATH_CONFLICT_POLICIES = ["reject", "suffix"] as const;

export type PathConflictPolicy = typeof PATH_CONFLICT_POLICIES[number];

export interface AssetPathAllocatorOptions {
  projector: AssetProjector;
  identity: IdentitySidecar;
}

export interface AssetPathRequest {
  source: AssetSourcePath;
  siblingExtensions: readonly string[];
  assetId?: string;
  onPathConflict?: PathConflictPolicy;
}

export class AssetPathAllocator {
  #projector: AssetProjector;
  #identity: IdentitySidecar;

  constructor(
    options: AssetPathAllocatorOptions
  ) {
    this.#projector = options.projector;
    this.#identity = options.identity;
  }

  allocate(
    request: AssetPathRequest
  ): Result<AssetSourcePath, AssetPathConflictError> {
    const { source, siblingExtensions, assetId } = request;

    let candidate = source;
    let vacant = this.#vacantGroup(candidate, siblingExtensions, assetId);
    for (
      let index = 2;
      !vacant.ok && request.onPathConflict === "suffix";
      index++
    ) {
      candidate = source.withName(`${source.name}-${index}`);
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
    const recorded = this.#identity.byPath(path)?.id;
    if (
      recorded === undefined ||
      this.#projector.desired(recorded) !== null
    ) {
      return undefined;
    }

    return recorded;
  }

  #vacantGroup(
    source: AssetSourcePath,
    siblingExtensions: readonly string[],
    assetId: string | undefined
  ): Result<void, AssetPathConflictError> {
    const owner = this.vacant(source.toString(), assetId);
    if (!owner.ok) {
      return owner;
    }

    for (const extension of siblingExtensions) {
      const sibling = this.vacant(siblingPath(source, extension), undefined);
      if (!sibling.ok) {
        return sibling;
      }
    }

    return Ok(undefined);
  }
}

export function siblingPath(
  source: AssetSourcePath,
  extension: string
): string {
  return `${source.directory}${source.name}${extension}`;
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
