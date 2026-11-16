// Import Third-party Dependencies
import type {
  FastifyReply,
  FastifyRequest,
  RequestPayload
} from "fastify";
import type {
  Account,
  Member
} from "@jolly-pixel/accounts";
import type {
  Accounts,
  AccountsRealm
} from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import { ApiError } from "./errors/ApiError.ts";
import type { RequestScoped } from "./RequestScoped.ts";

declare module "fastify" {
  interface FastifyRequest {
    account: Member | null;
  }
}

export type AuthenticateHook = (
  request: FastifyRequest,
  reply: FastifyReply,
  payload: RequestPayload
) => Promise<RequestPayload>;

export function authenticate(
  realm: RequestScoped<AccountsRealm>
): AuthenticateHook {
  return async(request, _reply, payload) => {
    request.account = realm(request).signedIn(request.headers);
    signedInAccount(request);

    return payload;
  };
}

export function signedInAccount(
  request: FastifyRequest
): Member {
  if (request.account === null) {
    throw unauthenticated();
  }

  return request.account;
}

export function sessionAccount(
  accounts: Pick<Accounts, "signedIn">,
  request: FastifyRequest
): Account {
  const account = accounts.signedIn(request.headers);
  if (account === null) {
    throw unauthenticated();
  }

  return account;
}

function unauthenticated(): ApiError {
  return new ApiError(401, "unauthenticated", "no valid session");
}
