// Import Internal Dependencies
import {
  InvalidVoxelWorldError
} from "./errors/InvalidVoxelWorldError.ts";
import {
  VOXEL_WORLD_VERSION,
  type VoxelWorldJSON
} from "./types.ts";

export function parseVoxelWorld(
  value: unknown
): VoxelWorldJSON {
  if (typeof value !== "object" || value === null) {
    throw new InvalidVoxelWorldError("payload is not an object");
  }

  const fields: Map<string, unknown> = new Map(Object.entries(value));
  const version = fields.get("version");
  const chunkSize = fields.get("chunkSize");
  const layers = fields.get("layers");
  const objectLayers = fields.get("objectLayers");
  const tilesets = fields.get("tilesets");

  if (version !== VOXEL_WORLD_VERSION) {
    throw new InvalidVoxelWorldError(
      `unsupported version ${String(version)}`
    );
  }
  if (
    typeof chunkSize !== "number" ||
    !Number.isInteger(chunkSize) ||
    chunkSize <= 0
  ) {
    throw new InvalidVoxelWorldError(
      "chunkSize is not a positive integer"
    );
  }
  if (!Array.isArray(layers)) {
    throw new InvalidVoxelWorldError("layers is not an array");
  }

  const document: VoxelWorldJSON = {
    version,
    chunkSize,
    tilesets: Array.isArray(tilesets) ? tilesets : [],
    layers
  };
  if (Array.isArray(objectLayers)) {
    document.objectLayers = objectLayers;
  }

  return document;
}

export function encodeVoxelWorld(
  document: VoxelWorldJSON
): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify(document)
  );
}

export function decodeVoxelWorld(
  data: Uint8Array
): VoxelWorldJSON {
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      new TextDecoder().decode(data)
    );
  }
  catch (error) {
    throw new InvalidVoxelWorldError(
      "payload is not JSON",
      { cause: error }
    );
  }

  return parseVoxelWorld(parsed);
}
