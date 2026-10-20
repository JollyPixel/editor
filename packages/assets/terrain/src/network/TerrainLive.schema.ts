// Import Third-party Dependencies
import type { AssetRelaySchemas } from "@jolly-pixel/asset-server";
import type * as network from "@jolly-pixel/network";
import * as z from "zod/mini";

// Import Internal Dependencies
import { tilePatchesSchema } from "./TerrainCommand.schema.ts";
import { terrainInterestSchema } from "./TerrainInterest.ts";

// CONSTANTS
export const TERRAIN_INTEREST_CHANGED = "interest-changed";
export const TERRAIN_LIVE_PATCHED = "live-patched";

export const interestChangedSchema = z.extend(terrainInterestSchema, {
  action: z.literal(TERRAIN_INTEREST_CHANGED)
});

export const livePatchedSchema = z.object({
  action: z.literal(TERRAIN_LIVE_PATCHED),
  tiles: tilePatchesSchema
});

export const peerLivePatchedSchema = z.object({
  type: z.literal(TERRAIN_LIVE_PATCHED),
  from: z.string(),
  tiles: tilePatchesSchema
});

export type InterestChangedMessage = network.Infer<typeof interestChangedSchema>;
export type LivePatchedMessage = network.Infer<typeof livePatchedSchema>;
export type PeerLivePatchedMessage = network.Infer<typeof peerLivePatchedSchema>;
export type TerrainLiveMessage = InterestChangedMessage | LivePatchedMessage;

export const TERRAIN_RELAY_SCHEMAS: AssetRelaySchemas<TerrainLiveMessage> = {
  inbound: [interestChangedSchema, livePatchedSchema],
  outbound: [peerLivePatchedSchema]
};
