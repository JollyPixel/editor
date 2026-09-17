// Import Third-party Dependencies
import type { JSONSchema } from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  ASSET_ROOM_DELETED,
  ASSET_ROOM_REJECTED
} from "../kinds/AssetLiveProtocol.ts";

export const assetRoomDeletedSchema: JSONSchema = {
  title: ASSET_ROOM_DELETED,
  type: "object",
  properties: {
    type: { const: ASSET_ROOM_DELETED }
  },
  required: ["type"]
};

export const assetRoomRejectedSchema: JSONSchema = {
  title: ASSET_ROOM_REJECTED,
  type: "object",
  properties: {
    type: { const: ASSET_ROOM_REJECTED },
    reason: { type: "string" }
  },
  required: [
    "type",
    "reason"
  ]
};
