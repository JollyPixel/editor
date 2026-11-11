// Import Third-party Dependencies
import type { FastifyInstance } from "fastify";

// Import Internal Dependencies
import { signedInAccount } from "../http/authentication.ts";
import type { AuditFeed } from "./AuditFeed.ts";
import {
  AUDIT_ROUTES,
  auditQuerySchema,
  type AuditQuery
} from "../../audit/api.ts";

export interface AuditRoutesOptions {
  feed: AuditFeed;
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
    handler: (request) => options.feed.page(
      signedInAccount(request),
      request.query
    )
  });
}
