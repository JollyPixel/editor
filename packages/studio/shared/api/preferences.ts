// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import type { ApiRoute } from "./common.ts";

// CONSTANTS
export const PREFERENCES_URL_PATH = "/api/preferences/";
export const PREFERENCES_ROUTES = {
  list: {
    method: "GET",
    path: ""
  },
  replace: {
    method: "PUT",
    path: ":scope"
  }
} as const satisfies Record<string, ApiRoute>;

export const preferenceOverridesSchema = z.record(z.string(), z.unknown());

export const preferencesReplySchema = z.object({
  scopes: z.record(z.string(), preferenceOverridesSchema)
});

export const scopePreferencesReplySchema = z.object({
  overrides: preferenceOverridesSchema
});

export type PreferencesReply = z.infer<typeof preferencesReplySchema>;
export type ScopePreferencesReply = z.infer<
  typeof scopePreferencesReplySchema
>;
