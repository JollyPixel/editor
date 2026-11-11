// Import Third-party Dependencies
import {
  AUDIT_ROUTES,
  auditPageSchema,
  type AuditPage,
  type AuditQuery
} from "@jolly-pixel/server";

// Import Internal Dependencies
import {
  ApiEndpoint,
  type ApiEndpointOptions
} from "../api/ApiEndpoint.ts";

export class AuditClient {
  #endpoint: ApiEndpoint;

  constructor(
    options: ApiEndpointOptions
  ) {
    this.#endpoint = new ApiEndpoint(options);
  }

  page(
    query: AuditQuery = {}
  ): Promise<AuditPage> {
    return this.#endpoint.json(AUDIT_ROUTES.page, auditPageSchema, {
      query
    });
  }
}
