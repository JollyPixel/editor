// Import Third-party Dependencies
import * as z from "zod";

// CONSTANTS
export const PREFERENCES_URL_PATH = "/api/preferences/";

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
