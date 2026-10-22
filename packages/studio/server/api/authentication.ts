// Import Third-party Dependencies
import type {
  FastifyReply,
  FastifyRequest,
  RequestPayload
} from "fastify";
import type { Account } from "@jolly-pixel/accounts";
import type { Accounts } from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import { ApiError } from "./errors/ApiError.ts";

declare module "fastify" {
  interface FastifyRequest {
    account: Account | null;
  }
}

export type AuthenticateHook = (
  request: FastifyRequest,
  reply: FastifyReply,
  payload: RequestPayload
) => Promise<RequestPayload>;

export function authenticate(
  accounts: Accounts
): AuthenticateHook {
  return async(request, _reply, payload) => {
    request.account = accounts.signedIn(request.headers);
    signedInAccount(request);

    return payload;
  };
}

export function signedInAccount(
  request: FastifyRequest
): Account {
  if (request.account === null) {
    throw new ApiError(401, "unauthenticated", "no valid session");
  }

  return request.account;
}
