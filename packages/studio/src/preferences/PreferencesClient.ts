// Import Third-party Dependencies
import type { PreferenceOverrides } from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import {
  ApiEndpoint,
  type ApiEndpointOptions
} from "../api/ApiEndpoint.ts";
import {
  preferencesReplySchema,
  scopePreferencesReplySchema
} from "../../shared/api/preferences.ts";

export class PreferencesClient {
  #endpoint: ApiEndpoint;

  constructor(
    options: ApiEndpointOptions
  ) {
    this.#endpoint = new ApiEndpoint(options);
  }

  async list(): Promise<Map<string, PreferenceOverrides>> {
    const response = await this.#endpoint.send("");
    const { scopes } = preferencesReplySchema.parse(
      await response.json()
    );

    return new Map(Object.entries(scopes));
  }

  async replace(
    scope: string,
    overrides: PreferenceOverrides
  ): Promise<PreferenceOverrides> {
    const response = await this.#endpoint.send(encodeURIComponent(scope), {
      method: "PUT",
      keepalive: true,
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(overrides)
    });

    return scopePreferencesReplySchema.parse(
      await response.json()
    ).overrides;
  }
}
