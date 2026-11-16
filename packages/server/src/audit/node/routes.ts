// Import Third-party Dependencies
import type { FastifyInstance } from "fastify";

// Import Internal Dependencies
import { signedInAccount } from "../../http/node/authentication.ts";
import type { RequestScoped } from "../../http/node/RequestScoped.ts";
import type { AuditFeed } from "./AuditFeed.ts";
import {
  AUDIT_ROUTES,
  auditQuerySchema,
  type AuditQuery
} from "../api.ts";

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
  const { page } = AUDIT_ROUTES;

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
}
