// Import Node.js Dependencies
import { Readable } from "node:stream";

// Import Third-party Dependencies
import type { FastifyInstance } from "fastify";

// Import Internal Dependencies
import { signedInAccount } from "../../http/node/authentication.ts";
import { downloadRoute } from "../../http/node/downloadRoute.ts";
import type { RequestScoped } from "../../http/node/RequestScoped.ts";
import type { AuditFeed } from "./AuditFeed.ts";
import {
  AUDIT_EXPORT_MIME_TYPE,
  AUDIT_ROUTES,
  auditFilterSchema,
  auditQuerySchema,
  type AuditFilter,
  type AuditQuery
} from "../api.ts";

// CONSTANTS
const kExportFileName = "audit.csv";

export interface AuditRoutesOptions {
  feed: RequestScoped<AuditFeed>;
}

interface AuditPageRoute {
  Querystring: AuditQuery;
}

export async function auditRoutes(
  app: FastifyInstance,
  options: AuditRoutesOptions
): Promise<void> {
  const { page, actors } = AUDIT_ROUTES;

  app.route<AuditPageRoute>({
    method: page.method,
    url: page.path,
    schema: {
      querystring: auditQuerySchema
    },
    handler: (request) => options.feed(request).page(
      signedInAccount(request),
      request.query
    )
  });
  app.route({
    method: actors.method,
    url: actors.path,
    handler: (request) => options.feed(request).actors(
      signedInAccount(request)
    )
  });
  downloadRoute<AuditFilter>(app, {
    route: AUDIT_ROUTES.export,
    type: AUDIT_EXPORT_MIME_TYPE,
    schema: {
      querystring: auditFilterSchema
    },
    fileName: () => kExportFileName,
    body: (request) => Promise.resolve(Readable.from(
      options.feed(request).export(signedInAccount(request), request.query)
    ))
  });
}
