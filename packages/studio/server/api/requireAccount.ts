// Import Third-party Dependencies
import type { FastifyRequest } from "fastify";
import type { Account } from "@jolly-pixel/accounts";
import type { Accounts } from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import { ApiError } from "./errors/ApiError.ts";

export function requireAccount(
  accounts: Accounts,
  request: FastifyRequest
): Account {
  const account = accounts.signedIn(request.headers);
  if (account === null) {
    throw new ApiError(401, "unauthenticated", "no valid session");
  }

  return account;
}
