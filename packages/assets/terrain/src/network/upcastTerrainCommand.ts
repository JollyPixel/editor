// Import Third-party Dependencies
import { decodeBase64 } from "@jolly-pixel/utils";

// CONSTANTS
const kChunkFields = ["heights", "splat", "holes"] as const;
const kTileFields = {
  "heights-patched": "heights",
  "splat-patched": "splat",
  "holes-patched": "holes"
} as const;

type StoredFields = Record<string, unknown>;

export function upcastTerrainCommand(
  stored: unknown
): unknown {
  if (!isFields(stored) || typeof stored.action !== "string") {
    return stored;
  }

  if (stored.action === "chunk-added" || stored.action === "tier-changed") {
    return bytesFields(stored, kChunkFields);
  }

  const field = kTileFields[stored.action as keyof typeof kTileFields];
  if (field === undefined || !Array.isArray(stored.tiles)) {
    return stored;
  }

  return {
    ...stored,
    tiles: stored.tiles.map(
      (tile: unknown) => (isFields(tile) ? bytesFields(tile, [field]) : tile)
    )
  };
}

function bytesFields(
  fields: StoredFields,
  names: readonly string[]
): StoredFields {
  const upcast = { ...fields };
  for (const name of names) {
    const value = fields[name];
    if (typeof value === "string") {
      upcast[name] = decodeBase64(value) ?? value;
    }
  }

  return upcast;
}

function isFields(
  value: unknown
): value is StoredFields {
  return typeof value === "object" && value !== null;
}
