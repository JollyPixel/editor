// Import Third-party Dependencies
import type { PreferenceOverrides } from "@jolly-pixel/preferences";
import {
  PREFERENCES_ROUTES,
  preferencesReplySchema,
  scopePreferencesReplySchema
} from "@jolly-pixel/server";

// Import Internal Dependencies
import {
  ApiEndpoint,
  type ApiEndpointOptions
} from "../api/ApiEndpoint.ts";

export class PreferencesClient {
  #endpoint: ApiEndpoint;

  constructor(
    options: ApiEndpointOptions
  ) {
    this.#endpoint = new ApiEndpoint(options);
  }

  async list(): Promise<Map<string, PreferenceOverrides>> {
    const { scopes } = await this.#endpoint.json(
      PREFERENCES_ROUTES.list,
      preferencesReplySchema
    );

    return new Map(Object.entries(scopes));
  }

  async replace(
    scope: string,
    overrides: PreferenceOverrides
  ): Promise<PreferenceOverrides> {
    const reply = await this.#endpoint.json(
      PREFERENCES_ROUTES.replace,
      scopePreferencesReplySchema,
      {
        params: {
          scope
        },
        body: overrides,
        keepalive: true
      }
    );

    return reply.overrides;
  }
}
