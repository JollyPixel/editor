// Import Third-party Dependencies
import type {
  FastifyReply,
  FastifyRequest,
  RequestPayload
} from "fastify";
import type { Member } from "@jolly-pixel/accounts";
import type { AccountsRealm } from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import { ApiError } from "./errors/ApiError.ts";

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
  realm: AccountsRealm
): AuthenticateHook {
  return async(request, _reply, payload) => {
    request.account = realm.signedIn(request.headers);
    signedInAccount(request);

    return payload;
  };
}

export function signedInAccount(
  request: FastifyRequest
): Member {
  if (request.account === null) {
    throw new ApiError(401, "unauthenticated", "no valid session");
  }

  return request.account;
}
