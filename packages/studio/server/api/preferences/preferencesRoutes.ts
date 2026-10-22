// Import Third-party Dependencies
import type { FastifyInstance } from "fastify";
import type { Accounts } from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import {
  PreferencesController,
  type ReplacePreferencesRoute
} from "./PreferencesController.ts";
import type { PreferenceScopes } from "../../../shared/PreferenceScopes.ts";
import { preferenceOverridesSchema } from "../../../shared/api/preferences.ts";

// CONSTANTS
const kMaxBodyBytes = 64 * 1_024;

export interface PreferencesRoutesOptions {
  accounts: Accounts;
  scopes: PreferenceScopes;
}

export async function preferencesRoutes(
  app: FastifyInstance,
  options: PreferencesRoutesOptions
): Promise<void> {
  const controller = new PreferencesController(
    options.accounts,
    options.scopes
  );

  app.setErrorHandler((error) => {
    throw controller.failure(error);
  });

  app.route({
    method: "GET",
    url: "",
    handler: (request) => controller.list(request)
  });
  app.route<ReplacePreferencesRoute>({
    method: "PUT",
    url: ":scope",
    bodyLimit: kMaxBodyBytes,
    schema: {
      body: preferenceOverridesSchema
    },
    handler: (request) => controller.replace(request)
  });
}
