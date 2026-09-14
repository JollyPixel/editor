// Import Third-party Dependencies
import type { JSONSchema } from "@jolly-pixel/network";

// CONSTANTS
export const ASSET_ROOM_DELETED = "deleted";

export const assetRoomDeletedSchema: JSONSchema = {
  title: ASSET_ROOM_DELETED,
  type: "object",
  properties: {
    type: { const: ASSET_ROOM_DELETED }
  },
  required: ["type"]
};
