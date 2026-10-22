// Import Third-party Dependencies
import type {
  FastifyReply,
  FastifyRequest
} from "fastify";
import {
  AVATAR_VERSION_PARAM,
  type AccountReply,
  type CredentialsBody,
  type RegistrationBody
} from "@jolly-pixel/accounts";
import type {
  Accounts,
  Requester,
  SignIn
} from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import { signedInAccount } from "../authentication.ts";
import { ApiError } from "../errors/ApiError.ts";

// CONSTANTS
const kAvatarContentType = "image/webp";
const kImmutable = "public, max-age=31536000, immutable";
const kRevalidate = "no-cache";

export interface RegisterRoute {
  Body: RegistrationBody;
}

export interface LoginRoute {
  Body: CredentialsBody;
}

export interface ReplaceAvatarRoute {
  Body: Uint8Array;
}

export interface AvatarRoute {
  Params: {
    accountId: string;
  };
  Querystring: {
    [AVATAR_VERSION_PARAM]?: string | string[];
  };
}

export class AccountsController {
  #accounts: Accounts;

  constructor(
    accounts: Accounts
  ) {
    this.#accounts = accounts;
  }

  async register(
    request: FastifyRequest<RegisterRoute>,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const registration = await this.#accounts.register(
      request.body,
      this.#requester(request)
    );

    return registration.status === "pending" ?
      reply.code(202).send() :
      this.#signIn(reply.code(201), registration);
  }

  async login(
    request: FastifyRequest<LoginRoute>,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const signIn = await this.#accounts.login(
      request.body,
      this.#requester(request)
    );

    return this.#signIn(reply, signIn);
  }

  logout(
    request: FastifyRequest,
    reply: FastifyReply
  ): FastifyReply {
    return reply
      .code(204)
      .header("set-cookie", this.#accounts.signOut(this.#requester(request)))
      .send();
  }

  me(
    request: FastifyRequest
  ): AccountReply {
    return {
      account: signedInAccount(request)
    };
  }

  async replaceAvatar(
    request: FastifyRequest<ReplaceAvatarRoute>
  ): Promise<AccountReply> {
    const { id } = signedInAccount(request);

    return {
      account: await this.#accounts.replaceAvatar(id, request.body)
    };
  }

  avatar(
    request: FastifyRequest<AvatarRoute>,
    reply: FastifyReply
  ): FastifyReply {
    const stored = this.#accounts.avatar(request.params.accountId);
    if (stored === null) {
      throw new ApiError(404, "not-found", "the account has no avatar");
    }
    const version = request.query[AVATAR_VERSION_PARAM];

    return reply
      .header("content-type", kAvatarContentType)
      .header("cache-control", version === stored.hash ? kImmutable : kRevalidate)
      .header("cross-origin-resource-policy", "same-origin")
      .header("x-content-type-options", "nosniff")
      .send(stored.bytes);
  }

  #requester(
    request: FastifyRequest
  ): Requester {
    return {
      address: request.ip,
      secure: request.protocol === "https",
      headers: request.headers
    };
  }

  #signIn(
    reply: FastifyReply,
    signIn: SignIn
  ): FastifyReply {
    return reply
      .header("set-cookie", signIn.cookie)
      .send({
        account: signIn.account
      } satisfies AccountReply);
  }
}
