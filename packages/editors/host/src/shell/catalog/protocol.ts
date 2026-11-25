// Import Third-party Dependencies
import * as z from "zod/mini";
import type {
  RoomRejectionEvent,
  RoomRights
} from "@jolly-pixel/network/client";

// CONSTANTS
export const CATALOG_OPEN_MESSAGE_TYPE = "jolly-catalog-open";
export const CATALOG_RIGHTS_MESSAGE_TYPE = "jolly-catalog-rights";
export const CATALOG_DENIED_MESSAGE_TYPE = "jolly-catalog-denied";

const kOpenMessageSchema = z.object({
  type: z.literal(CATALOG_OPEN_MESSAGE_TYPE)
});
const kPortMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("command"),
    command: z.looseObject({
      type: z.string(),
      requestId: z.string()
    })
  }),
  z.object({
    type: z.literal("leave")
  })
]);

export interface CatalogOpenMessage {
  type: typeof CATALOG_OPEN_MESSAGE_TYPE;
}

export interface RelayedCommand {
  type: string;
  requestId: string;
}

export type CatalogPortMessage =
  | { type: "command"; command: RelayedCommand; }
  | { type: "leave"; };

export interface CatalogRightsMessage {
  type: typeof CATALOG_RIGHTS_MESSAGE_TYPE;
  rights: RoomRights;
}

export interface CatalogDeniedMessage {
  type: typeof CATALOG_DENIED_MESSAGE_TYPE;
  denial: RoomRejectionEvent;
}

export function isCatalogOpenMessage(
  data: unknown
): data is CatalogOpenMessage {
  return kOpenMessageSchema.safeParse(data).success;
}

export function isCatalogPortMessage(
  data: unknown
): data is CatalogPortMessage {
  return kPortMessageSchema.safeParse(data).success;
}
