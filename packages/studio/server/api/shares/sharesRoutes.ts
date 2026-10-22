// Import Third-party Dependencies
import type { FastifyInstance } from "fastify";
import type { Accounts } from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import {
  SharesController,
  type CreateShareRoute,
  type RevokeShareRoute
} from "./SharesController.ts";
import { createShareBodySchema } from "../../../shared/api/shares.ts";
import type { StudioShares } from "../../shares/StudioShares.ts";

export interface SharesRoutesOptions {
  accounts: Accounts;
  shares: StudioShares;
}

export async function sharesRoutes(
  app: FastifyInstance,
  options: SharesRoutesOptions
): Promise<void> {
  const controller = new SharesController(options.accounts, options.shares);

  app.setErrorHandler((error) => {
    throw controller.failure(error);
  });

  app.route<CreateShareRoute>({
    method: "POST",
    url: "",
    schema: {
      body: createShareBodySchema
    },
    handler: (request, reply) => controller.create(request, reply)
  });
  app.route({
    method: "GET",
    url: "",
    handler: (request) => controller.list(request)
  });
  app.route<RevokeShareRoute>({
    method: "DELETE",
    url: ":linkId",
    handler: (request, reply) => controller.revoke(request, reply)
  });
}
