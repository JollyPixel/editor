// Import Third-party Dependencies
import type { AssetRelaySchemas } from "@jolly-pixel/asset-server";
import type * as network from "@jolly-pixel/network";
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  MAX_PATCH_TILES,
  tilePatchSchema
} from "./TerrainCommand.schema.ts";
import { terrainInterestSchema } from "./TerrainInterest.ts";

// CONSTANTS
export const TERRAIN_INTEREST_CHANGED = "interest-changed";
export const TERRAIN_LIVE_PATCHED = "live-patched";
const kLiveTiles = z.array(tilePatchSchema).check(z.minLength(1), z.maxLength(MAX_PATCH_TILES));

export const interestChangedSchema = z.extend(terrainInterestSchema, {
  action: z.literal(TERRAIN_INTEREST_CHANGED)
});

export const livePatchedSchema = z.object({
  action: z.literal(TERRAIN_LIVE_PATCHED),
  tiles: kLiveTiles
});

export const peerLivePatchedSchema = z.object({
  type: z.literal(TERRAIN_LIVE_PATCHED),
  from: z.string(),
  tiles: kLiveTiles
});

export const TERRAIN_RELAY_SCHEMAS: AssetRelaySchemas = {
  inbound: [interestChangedSchema, livePatchedSchema],
  outbound: [peerLivePatchedSchema]
};

export type InterestChangedMessage = network.Infer<typeof interestChangedSchema>;
export type LivePatchedMessage = network.Infer<typeof livePatchedSchema>;
export type PeerLivePatchedMessage = network.Infer<typeof peerLivePatchedSchema>;
export type TerrainLiveMessage = InterestChangedMessage | LivePatchedMessage;
