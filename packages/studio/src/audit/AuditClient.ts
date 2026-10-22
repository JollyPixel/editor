// Import Internal Dependencies
import {
  ApiEndpoint,
  type ApiEndpointOptions
} from "../api/ApiEndpoint.ts";
import {
  auditPageSchema,
  type AuditPage,
  type AuditQuery
} from "../../shared/api/audit.ts";

export class AuditClient {
  #endpoint: ApiEndpoint;

  constructor(
    options: ApiEndpointOptions
  ) {
    this.#endpoint = new ApiEndpoint(options);
  }

  async page(
    query: AuditQuery = {}
  ): Promise<AuditPage> {
    const search = new URLSearchParams();
    for (const [name, value] of Object.entries(query)) {
      if (value !== undefined) {
        search.set(name, String(value));
      }
    }
    const response = await this.#endpoint.send(
      search.size === 0 ? "" : `?${search}`
    );

    return auditPageSchema.parse(await response.json());
  }
}
