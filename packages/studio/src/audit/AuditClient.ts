// Import Internal Dependencies
import {
  ApiEndpoint,
  type ApiEndpointOptions
} from "../api/ApiEndpoint.ts";
import {
  AUDIT_ROUTES,
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

  page(
    query: AuditQuery = {}
  ): Promise<AuditPage> {
    return this.#endpoint.json(AUDIT_ROUTES.page, auditPageSchema, {
      query
    });
  }
}
