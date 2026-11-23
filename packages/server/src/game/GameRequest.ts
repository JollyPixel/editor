// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import {
  GAME_ROUTES,
  artifactParamsSchema,
  gameExportQuerySchema,
  gameQuerySchema,
  moduleParamsSchema,
  moduleQuerySchema
} from "./api.ts";
import { routeParams } from "../http/routeParams.ts";

// CONSTANTS
const kGameRequestSchema = z.discriminatedUnion("route", [
  z.object({
    route: z.literal("manifest"),
    query: gameQuerySchema
  }),
  z.object({
    route: z.literal("artifact"),
    params: artifactParamsSchema
  }),
  z.object({
    route: z.literal("module"),
    params: moduleParamsSchema,
    query: moduleQuerySchema
  }),
  z.object({
    route: z.literal("export"),
    query: gameExportQuerySchema
  })
]);

export type GameRequest = z.infer<typeof kGameRequestSchema>;

export function parseGameRequest(
  path: string,
  search: URLSearchParams
): GameRequest | null {
  for (const [route, { path: pattern }] of Object.entries(GAME_ROUTES)) {
    const params = routeParams(pattern, path);
    if (params !== null) {
      const parsed = kGameRequestSchema.safeParse({
        route,
        params,
        query: Object.fromEntries(search)
      });

      return parsed.success ? parsed.data : null;
    }
  }

  return null;
}
