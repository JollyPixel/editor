// Import Internal Dependencies
import { VoxelWorld } from "../world/VoxelWorld.ts";
import {
  VoxelSerializer,
  type VoxelWorldJSON
} from "../serialization/VoxelSerializer.ts";
import type { VoxelMapState } from "./VoxelMapState.ts";

// CONSTANTS
const kSerializer = new VoxelSerializer();

export class InvalidVoxelMapDocumentError extends Error {
  constructor(
    reason: string,
    options?: { cause?: unknown; }
  ) {
    super(`Invalid voxel-map document: ${reason}`, options);
    this.name = "InvalidVoxelMapDocumentError";
  }
}

export function voxelMapSnapshot(
  state: VoxelMapState
): VoxelWorldJSON {
  return {
    version: 1,
    chunkSize: state.world.chunkSize,
    tilesets: state.tilesets,
    layers: state.world.getLayers().map((layer) => layer.toJSON()),
    objectLayers: [...state.world.getObjectLayers()]
  };
}

export function encodeVoxelMapDocument(
  state: VoxelMapState
): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify(voxelMapSnapshot(state))
  );
}

/**
 * Rejects malformed persisted documents.
 */
export function decodeVoxelMapDocument(
  data: Uint8Array
): VoxelWorldJSON {
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      new TextDecoder().decode(data)
    );
  }
  catch (error) {
    throw new InvalidVoxelMapDocumentError(
      "payload is not JSON",
      { cause: error }
    );
  }

  return asVoxelWorldJSON(parsed);
}

/**
 * Leaves invalid layer entries for `VoxelSerializer` to skip.
 */
export function asVoxelWorldJSON(
  parsed: unknown
): VoxelWorldJSON {
  if (typeof parsed !== "object" || parsed === null) {
    throw new InvalidVoxelMapDocumentError("payload is not an object");
  }

  const document = parsed as Partial<VoxelWorldJSON>;
  if (document.version !== 1) {
    throw new InvalidVoxelMapDocumentError(
      `unsupported version ${String(document.version)}`
    );
  }
  if (
    !Number.isInteger(document.chunkSize) ||
    (document.chunkSize as number) <= 0
  ) {
    throw new InvalidVoxelMapDocumentError(
      "chunkSize is not a positive integer"
    );
  }
  if (!Array.isArray(document.layers)) {
    throw new InvalidVoxelMapDocumentError("layers is not an array");
  }

  return {
    ...document,
    version: 1,
    chunkSize: document.chunkSize as number,
    tilesets: Array.isArray(document.tilesets) ? document.tilesets : [],
    layers: document.layers
  };
}

/**
 * Rejects documents whose chunk size differs from the target world.
 */
export function loadVoxelMapDocument(
  state: VoxelMapState,
  document: VoxelWorldJSON
): void {
  if (document.chunkSize !== state.world.chunkSize) {
    throw new InvalidVoxelMapDocumentError(
      `chunkSize ${document.chunkSize} does not match the world's ${state.world.chunkSize}`
    );
  }

  kSerializer.deserialize(document, state.world);
  state.tilesets = [...document.tilesets];
}

export function createVoxelMapState(
  chunkSize: number
): VoxelMapState {
  return {
    world: new VoxelWorld(chunkSize),
    tilesets: []
  };
}
