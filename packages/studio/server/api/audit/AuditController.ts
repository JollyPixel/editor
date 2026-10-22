// Import Third-party Dependencies
import type { FastifyRequest } from "fastify";
import { AccountsError } from "@jolly-pixel/accounts";
import type { Accounts } from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import { ApiError } from "../errors/ApiError.ts";
import { accountsFailure } from "../errors/accountsFailure.ts";
import { requireAccount } from "../requireAccount.ts";
import type { AuditFeed } from "../../audit/AuditFeed.ts";
import { AuditRefusedError } from "../../audit/errors/AuditRefusedError.ts";
import type {
  AuditPage,
  AuditQuery
} from "../../../shared/api/audit.ts";

export interface AuditPageRoute {
  Querystring: AuditQuery;
}

export class AuditController {
  #accounts: Accounts;
  #feed: AuditFeed;

  constructor(
    accounts: Accounts,
    feed: AuditFeed
  ) {
    this.#accounts = accounts;
    this.#feed = feed;
  }

  page(
    request: FastifyRequest<AuditPageRoute>
  ): AuditPage {
    return this.#feed.page(
      requireAccount(this.#accounts, request),
      request.query
    );
  }

  failure(
    error: unknown
  ): unknown {
    if (error instanceof AccountsError) {
      return accountsFailure(error);
    }
    if (error instanceof AuditRefusedError) {
      return new ApiError(403, "audit-refused", error.message);
    }

    return error;
  }
}
