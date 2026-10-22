// Import Third-party Dependencies
import type { FastifyInstance } from "fastify";

// Import Internal Dependencies
import { signedInAccount } from "../authentication.ts";
import type { StoredPreferences } from "../../preferences/StoredPreferences.ts";
import {
  PREFERENCES_ROUTES,
  preferenceOverridesSchema
} from "../../../shared/api/preferences.ts";

// CONSTANTS
const kMaxBodyBytes = 64 * 1_024;

export interface PreferencesRoutesOptions {
  preferences: StoredPreferences;
}

interface ReplacePreferencesRoute {
  Params: {
    scope: string;
  };
  Body: Record<string, unknown>;
}

export async function preferencesRoutes(
  app: FastifyInstance,
  options: PreferencesRoutesOptions
): Promise<void> {
  const { preferences } = options;
  const { list, replace } = PREFERENCES_ROUTES;

  app.route({
    method: list.method,
    url: list.path,
    handler: (request) => preferences.list(signedInAccount(request))
  });
  app.route<ReplacePreferencesRoute>({
    method: replace.method,
    url: replace.path,
    bodyLimit: kMaxBodyBytes,
    schema: {
      body: preferenceOverridesSchema
    },
    handler: (request) => preferences.replace(
      signedInAccount(request),
      request.params.scope,
      request.body
    )
  });
}
