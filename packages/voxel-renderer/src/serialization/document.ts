// Import Internal Dependencies
import {
  InvalidVoxelDocumentError
} from "./errors/InvalidVoxelDocumentError.ts";
import type { VoxelWorldJSON } from "./types.ts";

export function parseVoxelDocument(
  value: unknown
): VoxelWorldJSON {
  if (typeof value !== "object" || value === null) {
    throw new InvalidVoxelDocumentError("payload is not an object");
  }

  const fields: Map<string, unknown> = new Map(Object.entries(value));
  const version = fields.get("version");
  const chunkSize = fields.get("chunkSize");
  const layers = fields.get("layers");
  const blocks = fields.get("blocks");
  const objectLayers = fields.get("objectLayers");
  const tilesets = fields.get("tilesets");

  if (version !== 1) {
    throw new InvalidVoxelDocumentError(
      `unsupported version ${String(version)}`
    );
  }
  if (
    typeof chunkSize !== "number" ||
    !Number.isInteger(chunkSize) ||
    chunkSize <= 0
  ) {
    throw new InvalidVoxelDocumentError(
      "chunkSize is not a positive integer"
    );
  }
  if (!Array.isArray(layers)) {
    throw new InvalidVoxelDocumentError("layers is not an array");
  }

  const document: VoxelWorldJSON = {
    version,
    chunkSize,
    tilesets: Array.isArray(tilesets) ? tilesets : [],
    layers
  };
  if (Array.isArray(blocks)) {
    document.blocks = blocks;
  }
  if (Array.isArray(objectLayers)) {
    document.objectLayers = objectLayers;
  }

  return document;
}

export function encodeVoxelDocument(
  document: VoxelWorldJSON
): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify(document)
  );
}

export function decodeVoxelDocument(
  data: Uint8Array
): VoxelWorldJSON {
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      new TextDecoder().decode(data)
    );
  }
  catch (error) {
    throw new InvalidVoxelDocumentError(
      "payload is not JSON",
      { cause: error }
    );
  }

  return parseVoxelDocument(parsed);
}
