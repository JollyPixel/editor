// Import Third-party Dependencies
import type { FastifyInstance } from "fastify";
import type { Accounts } from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import {
  AuditController,
  type AuditPageRoute
} from "./AuditController.ts";
import type { AuditFeed } from "../../audit/AuditFeed.ts";
import { auditQuerySchema } from "../../../src/audit/routes.ts";

export interface AuditRoutesOptions {
  accounts: Accounts;
  feed: AuditFeed;
}

export async function auditRoutes(
  app: FastifyInstance,
  options: AuditRoutesOptions
): Promise<void> {
  const controller = new AuditController(
    options.accounts,
    options.feed
  );

  app.setErrorHandler((error) => {
    throw controller.failure(error);
  });

  app.route<AuditPageRoute>({
    method: "GET",
    url: "",
    schema: {
      querystring: auditQuerySchema
    },
    handler: (request) => controller.page(request)
  });
}
