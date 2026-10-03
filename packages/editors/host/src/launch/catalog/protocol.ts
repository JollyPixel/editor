// Import Third-party Dependencies
import * as z from "zod";

// CONSTANTS
export const CATALOG_OPEN_MESSAGE_TYPE = "jolly-catalog-open";

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
