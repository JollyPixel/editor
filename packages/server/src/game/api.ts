// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import type { ApiRoute } from "../http/api.ts";

// CONSTANTS
export const GAME_URL_PATH = "/api/game/";
export const GAME_ROUTES = {
  manifest: {
    method: "GET",
    path: ""
  },
  artifact: {
    method: "GET",
    path: "builds/:assetId/:revision/:name"
  }
} as const satisfies Record<string, ApiRoute>;

export const gameQuerySchema = z.object({
  start: z.string().min(1)
});

export type GameQuery = z.infer<typeof gameQuerySchema>;

export const artifactParamsSchema = z.object({
  assetId: z.string().min(1),
  revision: z.string().min(1),
  name: z.string().min(1)
});

export type ArtifactParams = z.infer<typeof artifactParamsSchema>;
