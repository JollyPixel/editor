// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import type { ApiRoute } from "../http/api.ts";

// CONSTANTS
export const GAME_URL_PATH = "/api/game/";
export const GAME_MODULES_DIR = "modules";
export const GAME_ROUTES = {
  manifest: {
    method: "GET",
    path: ""
  },
  artifact: {
    method: "GET",
    path: "builds/:assetId/:revision/:name"
  },
  module: {
    method: "GET",
    path: `${GAME_MODULES_DIR}/*`
  },
  export: {
    method: "GET",
    path: "export"
  }
} as const satisfies Record<string, ApiRoute>;

export const GAME_EXPORT_ASSETS = ["reachable", "all"] as const;

export const gameExportQuerySchema = z.object({
  assets: z.enum(GAME_EXPORT_ASSETS).default("reachable")
});

export type GameExportAssets = typeof GAME_EXPORT_ASSETS[number];
export type GameExportQuery = z.infer<typeof gameExportQuerySchema>;

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

export const moduleParamsSchema = z.object({
  "*": z.string().min(1)
});

export type ModuleParams = z.infer<typeof moduleParamsSchema>;

export const moduleQuerySchema = z.object({
  revision: z.string().min(1).optional()
});

export type ModuleQuery = z.infer<typeof moduleQuerySchema>;
