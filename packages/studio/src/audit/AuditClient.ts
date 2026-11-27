// Import Third-party Dependencies
import {
  AUDIT_ROUTES,
  AttachmentDisposition,
  auditActorsSchema,
  auditPageSchema,
  type AuditActor,
  type AuditFilter,
  type AuditPage,
  type AuditQuery
} from "@jolly-pixel/server";

// Import Internal Dependencies
import {
  ApiEndpoint,
  type ApiEndpointOptions
} from "../api/ApiEndpoint.ts";
import { FileDownload } from "../browser/FileDownload.ts";

// CONSTANTS
const kExportFileName = "audit.csv";

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

  actors(): Promise<AuditActor[]> {
    return this.#endpoint.json(AUDIT_ROUTES.actors, auditActorsSchema);
  }

  async export(
    filter: AuditFilter = {}
  ): Promise<FileDownload> {
    const response = await this.#endpoint.send(AUDIT_ROUTES.export, {
      query: filter
    });
    const disposition = AttachmentDisposition.parse(
      response.headers.get("content-disposition")
    );

    return new FileDownload(
      await response.blob(),
      disposition?.fileName ?? kExportFileName
    );
  }
}
