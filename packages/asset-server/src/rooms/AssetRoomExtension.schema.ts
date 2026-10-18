// Import Third-party Dependencies
import {
  MessageProtocol,
  serverMessageProtocol,
  type Schema
} from "@jolly-pixel/network";
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  ASSET_ROOM_DELETED,
  ASSET_ROOM_REJECTED
} from "../kinds/AssetLiveProtocol.ts";

// CONSTANTS
const kAssetRoomDeletedSchema = z.object({
  type: z.literal(ASSET_ROOM_DELETED)
});

const kAssetRoomRejectedSchema = z.object({
  type: z.literal(ASSET_ROOM_REJECTED),
  reason: z.string()
});

export const assetRoomResumeSchema = z.object({
  clientId: z.string(),
  version: z.optional(z.int().check(z.minimum(0)))
});

export function assetRoomOutboundProtocol(
  command: MessageProtocol,
  snapshot: Schema,
  relay: readonly Schema[] = []
): MessageProtocol {
  return serverMessageProtocol({
    command,
    snapshot,
    notices: [
      kAssetRoomDeletedSchema,
      kAssetRoomRejectedSchema,
      ...relay
    ]
  });
}

export function assetRoomInboundProtocol(
  command: MessageProtocol,
  relay: readonly Schema[]
): MessageProtocol {
  if (relay.length === 0) {
    return command;
  }

  return new MessageProtocol(
    z.union([
      ...command.variants.map(({ schema }) => schema),
      ...relay
    ]),
    {
      discriminator: command.discriminator
    }
  );
}
